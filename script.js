document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Element Selection ---
  const dropZone = document.getElementById('dropZone');
  const dropText = document.getElementById('dropText');
  const imagePreview = document.getElementById('imagePreview');
  const previewImage = document.getElementById('previewImage');
  const filePicker = document.getElementById('filePicker');
  const generateBtn = document.getElementById('generateBtn');
  const clearBtn = document.getElementById('clearBtn');
  const extraPrompt = document.getElementById('extra');
  const spinnerContainer = document.getElementById('spinnerContainer');
  const resultBox = document.getElementById('resultBox');
  const resultContent = document.getElementById('resultContent');

  let currentFile = null; // Store the selected file

  // --- File Handling ---

  // 1. Drag and Drop Events
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('active');
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.classList.remove('active');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('active');
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  });

  // 2. Click to Upload (via label)
  dropZone.addEventListener('click', () => {
    filePicker.click();
  });

  // 3. File Picker Change Event
  filePicker.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFile(file);
    }
  });

  /**
   * Processes the selected file, validates it, and shows a preview.
   * @param {File} file The file selected by the user.
   */
  function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      showError('Please upload an image file (JPEG, PNG).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError('File is too large. Please upload an image under 10 MB.');
      return;
    }

    currentFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      imagePreview.style.display = 'block';
      dropText.style.display = 'none';
      resultBox.style.display = 'none';
      resultContent.innerHTML = ''; // Clear old results
    };
    reader.readAsDataURL(file);
  }

  // --- Button Controls ---

  // 1. Clear Button
  clearBtn.addEventListener('click', () => {
    currentFile = null;
    filePicker.value = '';
    extraPrompt.value = '';
    previewImage.src = '';
    imagePreview.style.display = 'none';
    dropText.style.display = 'flex';
    resultBox.style.display = 'none';
    resultContent.innerHTML = ''; // Clear result content
    spinnerContainer.style.display = 'none';
  });

  // 2. Generate Button
  generateBtn.addEventListener('click', () => {
    if (!currentFile) {
      showError('Please upload an image first.');
      return;
    }

    spinnerContainer.style.display = 'flex';
    resultBox.style.display = 'none';
    resultContent.innerHTML = ''; // Clear old content

    callGeminiAPI();
  });

  /**
   * Displays an error message in the result box.
   * @param {string} message The error message to display.
   */
  function showError(message) {
    // Use innerHTML to render the styled error message
    resultContent.innerHTML = `<p style="color: #ff9a9a;"><strong>Error:</strong> ${message}</p>`;
    resultBox.style.display = 'block';
    spinnerContainer.style.display = 'none';
  }

  /**
   * Formats and displays the structured JSON result.
   * @param {object} result The parsed JSON object from the API.
   */
  function displayResults(result) {
    if (result.diseaseName && result.treatmentSteps) {
      // Helper function to format numbered lists
      const formatList = (text) => {
        if (!text) return "N/A";
        return text
          .replace(/(\d+\.)/g, '<br><strong>$1</strong>') // Add <br> and bold numbers
          .replace(/^\s*<br>/, ''); // Remove leading <br> if it exists
      };

      const formattedTreatment = formatList(result.treatmentSteps);
      const formattedMedicines = result.suggestedMedicines || "N/A (See treatment plan)";
      // NEW: Format prevention tips
      const formattedPrevention = formatList(result.futurePreventionTips);


      resultContent.innerHTML = `
                        <h3>🌿 Disease Identified</h3>
                        <p><strong>${result.diseaseName}</strong></p>
                        
                        <h3>💊 Recommended Treatment</h3>
                        <p>${formattedTreatment}</p>

                        <h3>🧪 Suggested Medicines</h3>
                        <p>${formattedMedicines}</p>

                        <!-- NEW SECTION -->
                        <h3>🛡️ Future Prevention Tips</h3>
                        <p>${formattedPrevention}</p>
                    `;
    } else if (result.diseaseName && result.diseaseName.includes("Error: No crops found")) {
      resultContent.innerHTML = `<p style="color: #ffd700;"><strong>No Crop Found:</strong> The AI reported it could not find a crop in the image. Please try a clearer picture of a plant.</p>`;
    } else {
      resultContent.innerHTML = `<p style="color: #ffd700;">Could not determine the disease from the image. The AI's response was incomplete. Please try a clearer picture.</p>`;
    }
  }


  // --- Gemini API Call ---

  /**
   * Reads the file as base64 and initiates the API call.
   */
  function callGeminiAPI() {
    const userPrompt = extraPrompt.value;
    const fileMimeType = currentFile.type;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result.split(',')[1];
      fetchWithBackoff(base64Data, fileMimeType, userPrompt);
    };
    reader.onerror = () => {
      showError('Failed to read the file.');
    };
    reader.readAsDataURL(currentFile);
  }

  /**
   * Makes the fetch request to the Gemini API with exponential backoff.
   * @param {string} base64Data The base64-encoded image data.
   * @param {string} mimeType The MIME type of the image.
   * @param {string} userPrompt The additional text prompt from the user.
   */
  async function fetchWithBackoff(base64Data, mimeType, userPrompt, maxRetries = 3) {
    const apiKey = "AIzaSyATiaozGvSsdFpnOft7y5gP-bWgiRfHpQ4"; // API key is handled by the environment
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    // --- MODIFIED SYSTEM PROMPT ---
    // Added futurePreventionTips
    const systemPrompt = `You are an expert botanist and plant pathologist named AgriDoc.
      Analyze the provided image of a crop.
      1. Identify the most likely disease affecting the plant.
      2. Provide a concise, step-by-step treatment plan.
      3. Suggest specific medicines, fungicides, or pesticides. If none, say "N/A".
      4. Provide actionable, step-by-step tips for future prevention.

      Format your response strictly as a JSON object with four keys: "diseaseName", "treatmentSteps", "suggestedMedicines", and "futurePreventionTips".
      Do not include any other text or markdown formatting like \`\`\`json.
      Example: {"diseaseName": "Powdery Mildew", "treatmentSteps": "1. Prune affected areas. 2. Apply a fungicide.", "suggestedMedicines": "Neem oil, Sulfur fungicide", "futurePreventionTips": "1. Ensure proper plant spacing. 2. Water at the base of the plant."}
      Important: If the reference image doesn't contain any crop, return: {"diseaseName": "Error: No crops found.", "treatmentSteps": "N/A", "suggestedMedicines": "N/A", "futurePreventionTips": "N/A"}`;

    const fullUserPrompt = userPrompt
      ? `User's additional context: "${userPrompt}".\n\nPlease analyze the image based on this context and return the JSON report.`
      : "Please identify the disease in this image, suggest a treatment, list appropriate medicines, and provide prevention tips in the required JSON format.";

    const payload = {
      contents: [
        {
          parts: [
            { "text": fullUserPrompt },
            {
              "inlineData": {
                "mimeType": mimeType,
                "data": base64Data
              }
            }
          ]
        }
      ],
      systemInstruction: {
        parts: [{ "text": systemPrompt }]
      },
      generationConfig: {
        // Request JSON output
        responseMimeType: "application/json",
        temperature: 0.4,
        topK: 32,
        topP: 1,
        maxOutputTokens: 8192,
      }
    };

    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          if (response.status === 429 || response.status >= 500) {
            throw new Error(`HTTP error! status: ${response.status}`);
          } else {
            const errorData = await response.json();
            console.error('API Error Data:', errorData);
            showError(`API request failed: ${errorData.error?.message || response.statusText}`);
            return;
          }
        }

        const result = await response.json();

        if (result.candidates && result.candidates.length > 0) {
          const part = result.candidates[0].content.parts[0];

          if (part.text) {
            let responseText = part.text;
            try {
              // Clean up potential markdown backticks
              const jsonStartIndex = responseText.indexOf("{");
              const jsonEndIndex = responseText.lastIndexOf("}");
              if (jsonStartIndex === -1 || jsonEndIndex === -1 || jsonEndIndex <= jsonStartIndex) {
                throw new Error("Could not find a valid JSON object in the AI response.");
              }
              responseText = responseText.substring(jsonStartIndex, jsonEndIndex + 1);

              const resultJson = JSON.parse(responseText);
              displayResults(resultJson); // Display formatted JSON

            } catch (parseError) {
              console.error("JSON Parse Error:", parseError, "Raw response:", responseText);
              showError(`Failed to parse AI response. Raw text: \n\n${responseText}`);
            }
          } else {
            showError('Received an empty response from the AI.');
          }

          resultBox.style.display = 'block';
        } else {
          console.error('Invalid response structure:', result);
          showError('Received an unexpected response from the AI. Check console for details.');
        }

        spinnerContainer.style.display = 'none';
        return; // Success

      } catch (error) {
        console.warn(`Attempt ${attempt + 1} failed:`, error.message);
        attempt++;
        if (attempt >= maxRetries) {
          showError('Failed to get a response from the AI after several attempts. Please try again later.');
          spinnerContainer.style.display = 'none';
        } else {
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  }

});