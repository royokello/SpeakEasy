# SpeakEasy

**SpeakEasy** is an intuitive web-based application that empowers users to control their PC using AI-driven natural language interactions. Effortlessly manage files, explore your content, and personalize your AI experience through user-friendly features.

## Features

### Control
- Execute natural language commands to manage your PC.
- Easily create, edit, move, and delete files and folders directly from the interface.

### Chat
- Ask questions in natural language to locate files, folders, or specific content.
- Get instant, context-aware responses to quickly find what you need.

### Collect
- Save, organize, and edit your queries and responses.
- Personalize and fine-tune your AI model based on your saved interactions.

## Installation

```bash
git clone https://github.com/royokello/SpeakEasy.git
cd SpeakEasy
pip install -r requirements.txt
```

## Usage

Start the backend:

```bash
ollama serve
```

Start the frontend:

```bash
python -m http.server 8000
```

Access the application via your browser at `http://127.0.0.1:8000`.

## Contributing

Contributions are welcome! Feel free to fork the repository, create a feature branch, and submit a pull request.
