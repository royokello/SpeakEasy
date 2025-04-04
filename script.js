// Utility function to load an HTML template from the templates folder
async function loadTemplate(templateName) {
    try {
      const response = await fetch(`templates/${templateName}.html`);
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      return await response.text();
    } catch (error) {
      console.error('Error loading template:', error);
      return `<p>Error loading ${templateName} page.</p>`;
    }
  }
  
  // Function to load models from the Ollama backend and create radio buttons
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
  
  // Attach chat page event listener for the Prompt button
  function attachChatListener() {
    document.getElementById('button-prompt').addEventListener('click', () => {
      console.log("button clicked...");
      const selectedModel = document.querySelector('input[name="model-selection"]:checked');
      console.log(selectedModel);
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
  }
  
  // Fetch and stream response from the backend
  async function fetchStreamResponse(prompt, model) {
    try {
      const url = 'http://127.0.0.1:11434/api/generate';
      const data = { model: model, prompt: prompt };
  
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  
  // Process and update the response text
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
  
  // Page switching logic using inline buttons
  const pageButtons = document.querySelectorAll('.page-button');
  const contentDiv = document.getElementById('content');
  
  function setActiveButton(activePage) {
    pageButtons.forEach(button => {
      if (button.dataset.page === activePage) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });
  }
  
  async function loadPage(page) {
    const template = await loadTemplate(page);
    contentDiv.innerHTML = template;
    if (page === 'chat') {
      // For chat page, load models and attach the event listener
      loadModels();
      attachChatListener();
    }
  }
  
  // Initialize with Chat page as default
  loadPage('chat');
  
  // Attach click listeners to the page buttons
  pageButtons.forEach(button => {
    button.addEventListener('click', () => {
      const page = button.dataset.page;
      setActiveButton(page);
      loadPage(page);
    });
  });
  