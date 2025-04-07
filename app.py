from flask import Flask, render_template, request, redirect, url_for, flash
import os
import datetime
import base64
import ollama  # Make sure the Ollama Python library is installed

app = Flask(__name__)
app.secret_key = 'secret-key'

# Global variable for the root folder (provided as text)
ROOT_FOLDER = None

def get_models():
    """Fetch available models from Ollama using the new API."""
    try:
        models = ollama.list()
        return [model.model for model in models['models']]

    except Exception as e:
        print("Error fetching models:", e)
        return []

def get_chats():
    chats = []
    if ROOT_FOLDER and os.path.isdir(ROOT_FOLDER):
        for item in os.listdir(ROOT_FOLDER):
            chat_path = os.path.join(ROOT_FOLDER, item)
            if os.path.isdir(chat_path) and item.startswith("chat_"):
                latest = 0
                for f in os.listdir(chat_path):
                    if f.endswith(".txt"):
                        file_path = os.path.join(chat_path, f)
                        mtime = os.path.getmtime(file_path)
                        if mtime > latest:
                            latest = mtime
                chats.append({"name": item, "last": latest})
    chats.sort(key=lambda x: x["last"], reverse=True)
    return chats

def get_chat_history(chat_name):
    chat_dir = os.path.join(ROOT_FOLDER, chat_name)
    messages = []
    for f in os.listdir(chat_dir):
        if f.endswith(".txt"):
            messages.append(f)
    messages.sort()  # Filenames use timestamps so sorting works
    history = ""
    for filename in messages:
        with open(os.path.join(chat_dir, filename), "r", encoding="utf-8") as file:
            history += file.read() + "\n"
    return history

def write_message(chat_name, sender, message):
    chat_dir = os.path.join(ROOT_FOLDER, chat_name)
    now = datetime.datetime.now()
    # Format filename as "YYYY-MM-DD HH-MM sender.txt"
    timestamp = now.strftime("%Y-%m-%d %H-%M")
    filename = f"{timestamp} {sender}.txt"
    with open(os.path.join(chat_dir, filename), "w", encoding="utf-8") as f:
        f.write(message)

def create_new_chat():
    max_num = 0
    if ROOT_FOLDER:
        for item in os.listdir(ROOT_FOLDER):
            if os.path.isdir(os.path.join(ROOT_FOLDER, item)) and item.startswith("chat_"):
                try:
                    num = int(item.split("_")[1])
                    if num > max_num:
                        max_num = num
                except Exception:
                    pass
        new_chat = f"chat_{max_num + 1}"
        os.makedirs(os.path.join(ROOT_FOLDER, new_chat))
        return new_chat
    else:
        return None

def generate_agent_response(prompt, model, file_path=None):
    """
    Build a message for the Ollama chat API.
    If a file is attached, encode it in base64 and include it.
    """
    messages = [
        {
            'role': 'user',
            'content': prompt
        }
    ]
    if file_path:
        try:
            with open(file_path, 'rb') as image_file:
                encoded_image = base64.b64encode(image_file.read()).decode('utf-8')
            messages[0]['images'] = [encoded_image]
        except Exception as e:
            print("Error encoding file:", e)
    try:
        response = ollama.chat(model=model, messages=messages)
        return response['message']['content']
    except Exception as e:
        print("Error generating response:", e)
        return "Error generating response."

@app.route("/", methods=["GET"])
def index():
    global ROOT_FOLDER
    selected_chat = request.args.get("chat")
    folder_set = True if ROOT_FOLDER else False
    chats = get_chats() if folder_set else []
    if folder_set and not selected_chat and chats:
        selected_chat = chats[0]["name"]
    history = get_chat_history(selected_chat) if selected_chat and folder_set else ""
    models = get_models()
    print(f"models: {models}")
    return render_template(
        "index.html",
        folder_set=folder_set,
        root_folder=ROOT_FOLDER,
        chats=chats,
        selected_chat=selected_chat,
        history=history,
        models=models
    )

@app.route("/set_folder", methods=["POST"])
def set_folder():
    global ROOT_FOLDER
    # Now we simply expect the user to provide a full folder path in the text input.
    folder = request.form.get("root_folder")
    if folder and os.path.isdir(folder):
        ROOT_FOLDER = folder
        flash("Root folder set successfully.")
    else:
        flash("Invalid folder selection. Please try again.")
    return redirect(url_for("index"))

@app.route("/new_chat", methods=["POST"])
def new_chat():
    if not ROOT_FOLDER:
        flash("No root folder set. Please set a folder first.")
        return redirect(url_for("index"))
    new_chat_name = create_new_chat()
    return redirect(url_for("index", chat=new_chat_name))

@app.route("/send_message", methods=["POST"])
def send_message():
    chat_name = request.form.get("chat")
    message = request.form.get("message")
    selected_model = request.form.get("model")
    uploaded_file = request.files.get("attached_file")
    file_path = None

    if uploaded_file and uploaded_file.filename != "":
        chat_dir = os.path.join(ROOT_FOLDER, chat_name)
        now = datetime.datetime.now()
        timestamp = now.strftime("%Y-%m-%d %H-%M")
        filename = f"{timestamp} file_{uploaded_file.filename}"
        file_path = os.path.join(chat_dir, filename)
        uploaded_file.save(file_path)

    if message and selected_model:
        write_message(chat_name, "user", message)
        history = get_chat_history(chat_name)
        full_prompt = history + "\n" + message
        agent_response = generate_agent_response(full_prompt, selected_model, file_path=file_path)
        write_message(chat_name, "agent", agent_response)
    return redirect(url_for("index", chat=chat_name))

if __name__ == "__main__":
    app.run(debug=True)
