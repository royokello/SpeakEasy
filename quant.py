#!/usr/bin/env python
"""
quant.py
========
Post-training ternary quantization core and CLI for model weight files.

This script scans a local directory for `.safetensors` and `.bin`
files containing model state dicts, applies ternary quantization to 2D weight matrices,
performs 2-bit packing of the ternary codes, and writes out quantized files with the same
names in the specified output directory. Other files are copied unchanged.

Features:
- Progress reporting per layer (parameter)
- 2-bit packing reduces storage overhead by ~4× for codes
- File size summary: old vs new size and percent reduction
"""

import argparse
import os
import sys
import shutil

import torch
from safetensors.torch import load_file as st_load, save_file as st_save


def pack_2bit(codes: torch.Tensor) -> torch.Tensor:
    """
    Packs a uint8 tensor of codes in {0,1,2} into 2-bit-per-entry bytes.
    Returns a 1D uint8 tensor.
    """
    flat = codes.flatten()
    L = flat.numel()
    pad = (-L) % 4
    if pad:
        flat = torch.cat([flat, flat.new_zeros(pad)])
    # reshape to (num_bytes,4)
    grouped = flat.view(-1, 4)
    packed = (grouped[:,0]       |
              (grouped[:,1] << 2) |
              (grouped[:,2] << 4) |
              (grouped[:,3] << 6)).to(torch.uint8)
    return packed


def _ternarise_vector(v: torch.Tensor, thresh_factor: float):
    mu = v.abs().mean()
    tau = thresh_factor * mu
    q = v.sign() * (v.abs() >= tau).to(torch.float32)
    nz = q.abs() > 0
    if nz.any():
        s = v.abs()[nz].sum() / q.abs()[nz].sum()
    else:
        s = torch.tensor(0.0, dtype=torch.float32)
    q_int = q.to(torch.int8)
    return s, q_int


def ternarise(
        W: torch.Tensor,
        granularity: str = 'row',
        thresh_factor: float = 0.05
) -> (torch.Tensor, torch.Tensor):
    """
    Quantise a 2D weight tensor to ternary codes and scales.
    Returns codes and scales.
    """
    W32 = W.detach().to(torch.float32).cpu()
    M, N = W32.shape
    q_codes = torch.zeros_like(W32, dtype=torch.int8)
    scales = []

    if granularity == 'row':
        for i in range(M):
            s, q_int = _ternarise_vector(W32[i, :], thresh_factor)
            q_codes[i, :] = q_int
            scales.append(s)
    elif granularity == 'column':
        for j in range(N):
            s, q_int = _ternarise_vector(W32[:, j], thresh_factor)
            q_codes[:, j] = q_int
            scales.append(s)
    else:
        raise ValueError(f"Unknown granularity: {granularity}")

    codes_uint8 = (q_codes + 1).to(torch.uint8)  # in {0,1,2}
    scales_tensor = torch.stack(scales)
    return codes_uint8, scales_tensor


def process_state_dict(state_dict, granularity, thresh_factor):
    """
    Quantize all 2D tensors in state_dict, pack codes, and report per-layer progress.
    """
    quant_dict = {}
    # List of 2D layers
    layers = [(name, tensor) for name, tensor in state_dict.items()
              if isinstance(tensor, torch.Tensor) and tensor.ndim == 2]
    total = len(layers)
    for idx, (name, tensor) in enumerate(layers, 1):
        print(f"Quantizing layer {idx}/{total}: {name} shape={tuple(tensor.shape)}")
        codes, scales = ternarise(
            tensor,
            granularity=granularity,
            thresh_factor=thresh_factor
        )
        packed = pack_2bit(codes)
        # Store packed codes, scales, and original shape
        quant_dict[f"{name}.codes_packed"] = packed
        quant_dict[f"{name}.codes_shape"] = torch.tensor(tensor.shape, dtype=torch.int32)
        quant_dict[f"{name}.scales"] = scales
    # Copy other items
    for name, tensor in state_dict.items():
        if not (isinstance(tensor, torch.Tensor) and tensor.ndim == 2):
            quant_dict[name] = tensor
    return quant_dict


def format_size(bytes_size):
    for unit in ['B','KB','MB','GB','TB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.2f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.2f} PB"


def main():
    parser = argparse.ArgumentParser(
        description="Quantize and 2-bit pack model weight files"
    )
    parser.add_argument("--input", required=True, help="Input directory")
    parser.add_argument("--output", required=True, help="Output directory")
    parser.add_argument("--granularity", default="row", choices=["row","column"],
                        help="Quant granularity")
    parser.add_argument("--thresh_factor", type=float, default=0.05,
                        help="Threshold factor")
    args = parser.parse_args()

    if not os.path.isdir(args.input):
        print(f"Error: input path {args.input} is not a directory", file=sys.stderr)
        sys.exit(1)
    os.makedirs(args.output, exist_ok=True)

    files = os.listdir(args.input)
    for fname in files:
        src = os.path.join(args.input, fname)
        dst = os.path.join(args.output, fname)

        old_size = os.path.getsize(src)
        print(f"\n=== Converting {fname} (size: {format_size(old_size)}) ===")

        if fname.endswith('.safetensors'):
            state_dict = st_load(src)
            quant = process_state_dict(state_dict, args.granularity, args.thresh_factor)
            safe_dict = {k: v.cpu() for k, v in quant.items()}
            st_save(safe_dict, dst)
        elif fname.endswith('.bin'):
            state_dict = torch.load(src, map_location='cpu')
            quant = process_state_dict(state_dict, args.granularity, args.thresh_factor)
            torch.save(quant, dst)
        else:
            shutil.copy2(src, dst)

        new_size = os.path.getsize(dst)
        reduction = (old_size - new_size) / old_size * 100 if old_size > 0 else 0
        print(f"Saved {fname}: new size {format_size(new_size)}, reduced by {reduction:.2f}%")

    print("\nQuantization complete.")


if __name__ == "__main__":
    main()
