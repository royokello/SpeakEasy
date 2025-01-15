document.getElementById('query-button').addEventListener('click', () => {
    const queryInput = document.getElementById('query-input');
    const promptText = queryInput.value.trim();

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
            model: "phi4:14b-q4_K_M",
            prompt: prompt
        };

        // Use fetch to make a POST request
        fetch(url, {
        method: 'POST', // Specify the HTTP method
        headers: {
            'Content-Type': 'application/json' // Set header for JSON content
        },
        body: JSON.stringify(data) // Convert JavaScript object to JSON string
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

        }) // Parse JSON response if needed
        .then(data => console.log('Success:', data)) // Handle success
        .catch((error) => console.error('Error:', error)); // Handle errors

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

    // Append the new part of the response text
    resultArea.innerText = currentText + (currentText ? ' ' : '') + responseText;

    // Scroll to the bottom if not already visible
    resultArea.scrollTop = resultArea.scrollHeight;
}