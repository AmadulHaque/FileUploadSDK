/**
 * FileUploadSDK
 * A lightweight, customizable file upload library with drag-and-drop support.
 * @version 1.0.0
 */
class FileUploadSDK {
    /**
     * Creates a new FileUploadSDK instance
     * @param {Object} config - Configuration options
     * @param {string} config.containerId - ID of the container element to render the uploader in
     * @param {number} [config.maxFiles=10] - Maximum number of files allowed
     * @param {number} [config.maxSizeMB=5] - Maximum file size in MB
     * @param {string[]} [config.inputName='files[]'] - Maximum file size in MB
     * @param {string[]} [config.allowedTypes=['image/jpeg','image/png','image/gif','image/webp','application/pdf','image/svg+xml']] - Array of allowed MIME types
     * @param {Object} [config.labels] - Custom text labels
     * @param {string} [config.labels.dropText='Upload or drag and drop here'] - Main upload area text
     * @param {string} [config.labels.helpText='Max {maxFiles} files, size {maxSize}MB each.'] - Help text for upload area
     * @param {Object} [config.icons] - Custom icons options
     * @param {string} [config.icons.uploadIcon] - SVG string for upload icon (defaults to image icon)
     * @param {string} [config.icons.pdfIcon='📄'] - Icon for PDF files
     * @param {Function} [config.onFileAdded] - Callback when file is added successfully
     * @param {Function} [config.onFileRemoved] - Callback when file is removed
     * @param {Function} [config.onValidationFail] - Callback when file validation fails
     */
    constructor(config) {
      // Required config
      if (!config.containerId) {
        throw new Error('FileUploadSDK: containerId is required');
      }
      
      // Store container reference
      this.container = document.getElementById(config.containerId);
      if (!this.container) {
        throw new Error(`FileUploadSDK: Element with ID '${config.containerId}' not found`);
      }
      
      // Set configuration with defaults
      this.config = {
        maxFiles: config.maxFiles || 10,
        inputName: config.inputName || 'files[]',
        maxSizeMB: config.maxSizeMB || 5,
        allowedTypes: config.allowedTypes || [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/pdf',
          'image/svg+xml'
        ],
        labels: {
          dropText: (config.labels && config.labels.dropText) || 'Upload or drag and drop here',
          helpText: (config.labels && config.labels.helpText) || 
                   `Max {maxFiles} files, size {maxSize}MB each. ${this._getAllowedTypesString(config.allowedTypes)}`
        },
        icons: {
          uploadIcon: (config.icons && config.icons.uploadIcon) || this._getDefaultUploadIcon(),
          pdfIcon: (config.icons && config.icons.pdfIcon) || '📄'
        },
        onFileAdded: config.onFileAdded || (() => {}),
        onFileRemoved: config.onFileRemoved || (() => {}),
        onValidationFail: config.onValidationFail || ((error) => { alert(error); })
      };
      
      // Replace placeholders in help text
      this.config.labels.helpText = this.config.labels.helpText
        .replace('{maxFiles}', this.config.maxFiles)
        .replace('{maxSize}', this.config.maxSizeMB);
      
      // Internal state
      this.selectedFiles = [];
      
      // Initialize the UI
      this._renderUI();
      
      // Set up event listeners
      this._setupEventListeners();
    }
    
    /**
     * Gets all currently selected files
     * @returns {File[]} Array of selected File objects
     */
    getFiles() {
      return [...this.selectedFiles];
    }
    
    /**
     * Clears all selected files
     */
    clearFiles() {
      this.selectedFiles = [];
      this.previewArea.innerHTML = '';
    }
    
    /**
     * Adds files programmatically
     * @param {FileList|File[]} files - Files to add
     */
    addFiles(files) {
      this._handleFiles(Array.from(files));
    }
    
    /**
     * Removes a file by its name
     * @param {string} fileName - Name of the file to remove
     * @returns {boolean} Whether the file was found and removed
     */
    removeFile(fileName) {

      const initialLength = this.selectedFiles.length;
      this.selectedFiles = this.selectedFiles.filter(file => file.name !== fileName);
      
      // Remove from UI if found
      const fileElement = this.previewArea.querySelector(`.file-upload-sdk-preview-item[data-file-name="${fileName}"]`);
      if (fileElement) {
        fileElement.remove();
      }
      
      const wasRemoved = initialLength > this.selectedFiles.length;
      if (wasRemoved) {
        this.config.onFileRemoved(fileName);
      }
      
      return wasRemoved;
    }
  
    /**
     * @private
     * Renders the UI elements
     */
    _renderUI() {
      // Main container styling
      this.container.className = 'file-upload-sdk-container';
      let inputId = this._generateId();
      // Create the layout structure
      this.container.innerHTML = `
        <div class="file-upload-sdk-drag-drop-area">
          <input type="file" 
                 class="file-upload-sdk-input" 
                 id="file-upload-sdk-input-${inputId}" 
                 name="${this.config.inputName}"
                 multiple>
          <label for="file-upload-sdk-input-${inputId}" class="file-upload-sdk-label">
            <div class="file-upload-sdk-icon">${this.config.icons.uploadIcon}</div>
            <p class="file-upload-sdk-text">${this.config.labels.dropText}</p>
            <small class="file-upload-sdk-help-text">${this.config.labels.helpText}</small>
          </label>
        </div>
        <div class="file-upload-sdk-preview-area"></div>
      `;
      
      // Save references to important elements
      this.dragDropArea = this.container.querySelector('.file-upload-sdk-drag-drop-area');
      this.fileInput = this.container.querySelector('.file-upload-sdk-input');
      this.previewArea = this.container.querySelector('.file-upload-sdk-preview-area');
      
      // Add base stylesheet 
      this._injectStyles();
    }
      
    /**
     * @private
     * Sets up all necessary event listeners
     */
    _setupEventListeners() {
      // Drag and drop events
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        this.dragDropArea.addEventListener(eventName, this._preventDefaults.bind(this), false);
        document.body.addEventListener(eventName, this._preventDefaults.bind(this), false);
      });
      
      // Add highlighting classes for dragover
      ['dragenter', 'dragover'].forEach(eventName => {
        this.dragDropArea.addEventListener(eventName, () => {
          this.dragDropArea.classList.add('file-upload-sdk-drag-over');
        }, false);
      });
      
      // Remove highlighting classes for dragleave/drop
      ['dragleave', 'drop'].forEach(eventName => {
        this.dragDropArea.addEventListener(eventName, () => {
          this.dragDropArea.classList.remove('file-upload-sdk-drag-over');
        }, false);
      });
      
      // Handle dropped files
      this.dragDropArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        this._handleFiles(Array.from(files));
      }, false);
      
      // Handle file input changes
      this.fileInput.addEventListener('change', (e) => {
        this._handleFiles(Array.from(e.target.files));
        this.fileInput.value = ''; // Reset to allow re-uploading the same file
      });
    }
    
    /**
     * @private
     * Handles selected files processing
     * @param {File[]} files - Array of File objects
     */
    _handleFiles(files) {
      files.forEach(file => {
        // Check if we can add more files
        if (this.selectedFiles.length >= this.config.maxFiles) {
          this.config.onValidationFail(`Maximum number of files (${this.config.maxFiles}) reached.`);
          return;
        }
        
        // Validate file
        const validationError = this._validateFile(file);
        if (validationError) {
          this.config.onValidationFail(validationError);
          return;
        }
        
        // Check for duplicates by name and size
        if (this.selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
          // Silently skip duplicates
          return;
        }
        
        // Add file to our array
        this.selectedFiles.push(file);
        
        // Create preview
        this._createPreview(file);
        
        // Trigger callback
        this.config.onFileAdded(file);
      });
    }
    
    /**
     * @private
     * Validates if a file meets requirements
     * @param {File} file - File to validate
     * @returns {string|null} Error message or null if valid
     */
    _validateFile(file) {
      if (!this.config.allowedTypes.includes(file.type)) {
        return `File type not allowed: ${file.name} (${file.type || 'unknown'}). ${this._getAllowedTypesString()}.`;
      }
      
      const maxSizeBytes = this.config.maxSizeMB * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        return `File is too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB). Maximum size is ${this.config.maxSizeMB} MB.`;
      }
      
      return null;
    }
    
    /**
     * @private
     * Creates a preview for a file
     * @param {File} file - File to preview
     */
    _createPreview(file) {
      // Create container
      const previewContainer = document.createElement('div');
      previewContainer.classList.add('file-upload-sdk-preview-item');
      previewContainer.dataset.fileName = file.name;
      
      // Create remove button
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.classList.add('file-upload-sdk-remove-btn');
      removeBtn.innerHTML = '&times;';
      removeBtn.title = `Remove ${file.name}`;
      removeBtn.addEventListener('click', () => this.removeFile(file.name));
      
      // Check if PDF
      if (file.type === 'application/pdf') {
        previewContainer.classList.add('file-upload-sdk-pdf-preview');
        
        const icon = document.createElement('div');
        icon.classList.add('file-upload-sdk-pdf-icon');
        icon.textContent = this.config.icons.pdfIcon;
        
        const fileNameSpan = document.createElement('span');
        fileNameSpan.classList.add('file-upload-sdk-filename');
        fileNameSpan.textContent = this._truncateFilename(file.name);
        fileNameSpan.title = file.name;
        
        previewContainer.appendChild(icon);
        previewContainer.appendChild(fileNameSpan);
      } else {
        // For images
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onloadend = () => {
          const img = document.createElement('img');
          img.classList.add('file-upload-sdk-preview-image');
          img.src = reader.result;
          img.alt = `Preview of ${file.name}`;
          img.title = file.name;
          previewContainer.appendChild(img);
        };
        
        reader.onerror = () => {
          previewContainer.textContent = 'Error loading preview';
          previewContainer.classList.add('file-upload-sdk-preview-error');
        };
      }
      
      // Add removal button
      previewContainer.appendChild(removeBtn);
      
      // Add to preview area
      this.previewArea.appendChild(previewContainer);
    }
    
    /**
     * @private
     * Prevents default browser handling of drag events
     * @param {Event} e - Event object
     */
    _preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    /**
     * @private
     * Generates a random ID for input elements
     * @returns {string} Random ID
     */
    _generateId() {
      return Math.random().toString(36).substring(2, 10);
    }
    
    /**
     * @private
     * Truncates long filenames for display
     * @param {string} filename - Filename to truncate
     * @param {number} [maxLength=15] - Maximum length before truncation
     * @returns {string} Truncated filename
     */
    _truncateFilename(filename, maxLength = 15) {
      if (filename.length <= maxLength) return filename;
      
      const extension = filename.split('.').pop();
      const nameWithoutExt = filename.substring(0, filename.length - extension.length - 1);
      
      if (nameWithoutExt.length <= maxLength - 3) return filename;
      
      return `${nameWithoutExt.substring(0, maxLength - 3)}...${extension ? `.${extension}` : ''}`;
    }
    
    /**
     * @private
     * Gets a human-readable string of allowed file types
     * @returns {string} File type description
     */
    _getAllowedTypesString() {
      const typeMap = {
        'image/jpeg': 'JPG',
        'image/png': 'PNG',
        'image/gif': 'GIF',
        'image/webp': 'WEBP',
        'application/pdf': 'PDF',
        'image/svg+xml': 'SVG'
      };
      
      const types = this.config.allowedTypes.map(type => typeMap[type] || type.split('/')[1]?.toUpperCase() || type);
      return types.length > 0 ? `${types.join(', ')} only` : '';
    }
    
    /**
     * @private
     * Returns the default upload icon SVG
     * @returns {string} SVG string
     */
    _getDefaultUploadIcon() {
      return `<svg width="40" height="40" viewBox="0 0 49 49" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g clipPath="url(#clip0_upload_icon)">
          <path d="M12.7595 37.8349C9.4909 37.8349 6.58347 35.7421 5.52772 32.6264L5.45632 32.3917C5.20733 31.5666 5.10303 30.8727 5.10303 30.1785V16.2578L0.149896 32.7917C-0.487144 35.2236 0.964514 37.7448 3.40014 38.4166L34.9714 46.8716C35.3654 46.9737 35.7594 47.0226 36.1475 47.0226C38.1809 47.0226 40.0389 45.673 40.5597 43.6842L42.399 37.8349H12.7595Z" fill="#ECEFF1" />
          <path d="M48.9985 6.69738V30.1774C48.9985 32.7091 46.9364 34.7712 44.4047 34.7712H12.7579C12.5538 34.7712 12.3497 34.7507 12.1657 34.7301C10.0221 34.465 8.348 32.7091 8.18462 30.5449C8.16406 30.4222 8.16406 30.2996 8.16406 30.1774V6.69738C8.16406 4.16567 10.2262 2.10352 12.7579 2.10352H44.4047C46.9364 2.10352 48.9985 4.16567 48.9985 6.69738Z" fill="#ECEFF1" />
          <path d="M22.4558 12.3121C22.4558 14.5671 20.6277 16.3956 18.3726 16.3956C16.1172 16.3956 14.2891 14.5671 14.2891 12.3121C14.2891 10.057 16.1172 8.22852 18.3726 8.22852C20.6277 8.22852 22.4558 10.057 22.4558 12.3121Z" fill="#FFC107" />
          <path d="M49.0007 24.4407V30.1782C49.0007 32.7099 46.9386 34.772 44.4069 34.772H12.7601C12.556 34.772 12.3519 34.7515 12.168 34.7309L33.1978 13.7015C34.5862 12.313 36.8727 12.313 38.2612 13.7015L49.0007 24.4407Z" fill="#388E3C" />
          <path d="M36.8733 34.7725H12.7608C12.5567 34.7725 12.3526 34.7519 12.1686 34.7314C10.025 34.4663 8.35087 32.7103 8.1875 30.5461L17.8855 20.8477C19.274 19.4596 21.5605 19.4596 22.9489 20.8477L36.8733 34.7725Z" fill="#4CAF50" />
        </g>
        <defs>
          <clipPath id="clip0_upload_icon">
            <rect width="49" height="49" fill="white" />
          </clipPath>
        </defs>
      </svg>`;
    }
    
    /**
     * @private
     * Injects CSS styles into the document
     */
    _injectStyles() {
      // Create style element if it doesn't exist already
      if (!document.getElementById('file-upload-sdk-styles')) {
        const style = document.createElement('style');
        style.id = 'file-upload-sdk-styles';
        style.textContent = `
          /* FileUploadSDK Styles */
          .file-upload-sdk-container {
            font-family: sans-serif;
            width: 100%;
          }
          
          .file-upload-sdk-drag-drop-area {
            border: 2px dashed #adb5bd;
            border-radius: 8px;
            transition: border-color 0.3s ease, background-color 0.3s ease;
          }
          
          .file-upload-sdk-drag-over {
            border-color: #0d6efd;
            background-color: #e9f5ff;
          }
          
          .file-upload-sdk-input {
            display: none;
          }
          
          .file-upload-sdk-label {
            padding: 40px 20px;
            text-align: center;
            cursor: pointer;
            width: 100%;
            color: #495057;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          
          .file-upload-sdk-icon {
            margin-bottom: 10px;
            color: #6c757d;
          }
          
          .file-upload-sdk-text {
            margin: 10px 0 5px;
            font-weight: 500;
            font-size: 16px;
          }
          
          .file-upload-sdk-help-text {
            color: #6c757d;
            font-size: 14px;
          }
          
          .file-upload-sdk-preview-area {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin-top: 20px;
            min-height: 50px;
          }
          
          .file-upload-sdk-preview-item {
            position: relative;
            width: 100px;
            height: 100px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
            background-color: #f8f9fa;
          }
          
          .file-upload-sdk-preview-image {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          .file-upload-sdk-remove-btn {
            position: absolute;
            top: 5px;
            right: 5px;
            width: 20px;
            height: 20px;
            background-color: rgba(0, 0, 0, 0.6);
            color: white;
            border: none;
            border-radius: 50%;
            font-size: 12px;
            font-weight: bold;
            line-height: 20px;
            text-align: center;
            cursor: pointer;
            opacity: 0.8;
            transition: opacity 0.2s ease;
            padding: 0;
          }
          
          .file-upload-sdk-remove-btn:hover {
            opacity: 1;
          }
          
          .file-upload-sdk-pdf-preview {
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 10px;
            box-sizing: border-box;
          }
          
          .file-upload-sdk-pdf-icon {
            font-size: 3rem;
            color: #dc3545;
            margin-bottom: 5px;
          }
          
          .file-upload-sdk-filename {
            font-size: 0.75rem;
            color: #343a40;
            word-break: break-all;
            text-align: center;
            line-height: 1.2;
            max-height: 2.4em;
            overflow: hidden;
          }
          
          .file-upload-sdk-preview-error {
            background-color: #f8d7da;
            color: #721c24;
            font-size: 12px;
            text-align: center;
            padding: 5px;
          }
        `;
        document.head.appendChild(style);
      }
    }
}