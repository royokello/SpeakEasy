document.getElementById('button-prompt').addEventListener('click', () => {
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

    fetchStreamResponse(promptText);
});

async function fetchStreamResponse(prompt) {
    try {
        const url = 'http://127.0.0.1:11434/api/generate';
        const data = {
            model: "llama3.2:3b-instruct-q8_0",
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
    resultArea.innerText = currentText + (currentText ? ' ' : '') + responseText;
    resultArea.scrollTop = resultArea.scrollHeight;
}