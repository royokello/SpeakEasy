// // Function to load models and create radio buttons
async function loadModels() {
    try {
        const response = await fetch('http://localhost:11434/api/tags');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        
        const data = await response.json();

        const models = data.models;

        const radioContainer = document.getElementById('radio-container');
        radioContainer.innerHTML = '';

        models.forEach(model => {
            const label = document.createElement('label');
            const radioButton = document.createElement('input');

            radioButton.type = 'radio';
            radioButton.name = 'model-selection';
            radioButton.value = model.name;

            label.appendChild(radioButton);
            label.appendChild(document.createTextNode(`${model.name}`));

            radioContainer.appendChild(label);
            radioContainer.appendChild(document.createElement('br'));
        });
        
    } catch (error) {
        console.error('Error loading models:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadModels);

document.getElementById('button-prompt').addEventListener('click', () => {
    console.log("button clicked...")
    const selectedModel = document.querySelector('input[name="model-selection"]:checked');
    console.log(selectedModel)
    if (selectedModel) {

        const goalPrompt = document.getElementById('goal-prompt').value.trim();
        const returnFormatPrompt = document.getElementById('return-format-prompt').value.trim();
        const warningPrompt = document.getElementById('warning-prompt').value.trim();
        const contextPrompt = document.getElementById('context-prompt').value.trim();

        const promptText = [
            goalPrompt && `Goal: ${goalPrompt}`,
            returnFormatPrompt && `Return Format: ${returnFormatPrompt}`,
            warningPrompt && `Warning: ${warningPrompt}`,
            contextPrompt && `Context: ${contextPrompt}`
        ].filter(Boolean).join('\n\n');

        if (!promptText) {
            alert("Please enter a question or statement.");
            return;
        }

        const resultArea = document.getElementById('result-streaming');
        resultArea.innerText = "";

        fetchStreamResponse(promptText, selectedModel.value);

    } else {
        alert('Please select a model first.');
    }
});

async function fetchStreamResponse(prompt, model) {
    try {
        const url = 'http://127.0.0.1:11434/api/generate';
        const data = {
            // model: "phi4:/14b-q4_K_M",
            model: model,
            prompt: prompt
        };

        fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
        })
        .then(response => {
            const reader = response.body.getReader();
            let decoder = new TextDecoder();

            async function readStream() {
                while (true) {
                    const { done, value } = await reader.read();

                    if (done) break;

                    const chunkText = decoder.decode(value, { stream: true });
                    processResponse(chunkText);
                }
            }

            readStream().catch(error => console.error('Error reading response:', error));

        })
        .then(data => console.log('Success:', data))
        .catch((error) => console.error('Error:', error));

    } catch (error) {
        console.error('Fetch error:', error);
    }
}

function processResponse(text) {
    try {
        const jsonResponse = JSON.parse(text);

        if (!jsonResponse.done) {
            updateResult(jsonResponse.response);
        }
    } catch (error) {
        console.warn("Error parsing response:", error);
    }
}

function updateResult(responseText) {
    const resultArea = document.getElementById('result-streaming');
    const currentText = resultArea.innerText;
    resultArea.innerText = currentText + responseText;
    resultArea.scrollTop = resultArea.scrollHeight;
}