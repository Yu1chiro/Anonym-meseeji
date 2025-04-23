document.addEventListener('DOMContentLoaded', () => {
    // Check which page we're on
    if (document.getElementById('messageForm')) {
        // Form page logic
        const form = document.getElementById('messageForm');
        const messageStatus = document.getElementById('messageStatus');
        let token = null;

        // Get a one-time token when page loads
        fetch('/api/token')
            .then(response => response.json())
            .then(data => {
                token = data.token;
            })
            .catch(error => {
                console.error('Error fetching token:', error);
                messageStatus.textContent = 'Error getting security token. Please refresh the page.';
                messageStatus.classList.remove('hidden');
                messageStatus.classList.add('text-red-600');
            });

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                // Reset status message styling first
                messageStatus.classList.remove('hidden', 'text-red-600', 'text-white', 'bg-green-600', 'py-2', 'px-2', 'rounded-lg');
                
                if (!token) {
                    messageStatus.textContent = 'Security token not available. Please refresh the page.';
                    messageStatus.classList.add('text-red-600');
                    setTimeout(() => messageStatus.classList.add('hidden'), 2000);
                    return;
                }
            
                const message = document.getElementById('message').value;
            
                try {
                    // Create checksum
                    let checksum;
                    
                    if (window.crypto && window.crypto.subtle) {
                        const msgBuffer = new TextEncoder().encode(message + token);
                        const hashBuffer = await window.crypto.subtle.digest('SHA-1', msgBuffer);
                        const hashArray = Array.from(new Uint8Array(hashBuffer));
                        checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                    } else {
                        checksum = 'fallback-checksum';
                        console.warn('Web Crypto API not available, using fallback checksum');
                    }
            
                    // Prepare data
                    const data = {
                        message,
                        checksum
                    };
            
                    // Encode to base64
                    const encodedData = btoa(JSON.stringify(data));
            
                    // Send to server
                    const response = await fetch('/api/messages', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ 
                            encodedData,
                            token 
                        }),
                    });
            
                    const responseData = await response.json();
            
                    if (response.ok) {
                        messageStatus.textContent = 'Message sent successfully!';
                        messageStatus.classList.add('text-white', 'py-2', 'px-2', 'bg-green-600', 'rounded-lg', 'mb-3');
                        form.reset();
                        token = null;
                        
                        // Auto-hide success message after 3 seconds
                        setTimeout(() => messageStatus.classList.add('hidden'), 2000);
                    } else {
                        messageStatus.textContent = responseData.error || 'Error sending message';
                        messageStatus.classList.add('text-red-600');
                        form.reset();
                        
                        // Auto-hide error message after 3 seconds
                        setTimeout(() => messageStatus.classList.add('hidden'), 2000);
                    }
                } catch (error) {
                    console.error('Error:', error);
                    messageStatus.textContent = 'Error sending message: ' + error.message;
                    messageStatus.classList.add('text-white', 'py-2', 'px-2', 'bg-red-600', 'rounded-lg', 'mb-3');
                    form.reset();
                    
                    // Auto-hide error message after 3 seconds
                    setTimeout(() => messageStatus.classList.add('hidden'), 2000);
                }
            });
            } else if (document.getElementById('messagesTable')) {
                // Messages table page logic
                const messagesTable = document.getElementById('messagesTable');
                let currentToken = null;
              
                // Get token for delete operations
                fetch('/api/token')
                  .then(response => response.json())
                  .then(data => {
                    currentToken = data.token;
                  })
                  .catch(error => {
                    console.error('Error fetching token:', error);
                  });
              
                function loadMessages() {
                  fetch('/api/messages')
                    .then(response => response.json())
                    .then(messages => {
                      if (messages.length === 0) {
                        messagesTable.innerHTML = `
                          <tr>
                            <td colspan="4" class="px-6 py-4 text-center text-gray-500">No messages yet</td>
                          </tr>
                        `;
                        return;
                      }
              
                      messagesTable.innerHTML = messages.map(msg => `
                        <tr data-id="${msg._id}" class="hover:bg-gray-50">
                        <td class="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                          ${new Date(msg.createdAt).toLocaleString()}
                        </td>
                          <td class="px-3 py-3 whitespace-pre-wrap text-sm text-gray-500">${msg.message}</td>
                          <td class="px-3 py-3">
                            <button 
                              class="delete-btn text-red-500 hover:text-red-700 font-semibold"
                              data-id="${msg._id}"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      `).join('');
              
                      // Add event listeners to all delete buttons
                      document.querySelectorAll('.delete-btn').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                          const messageId = e.target.getAttribute('data-id');
                          if (!currentToken) {
                            alert('Security token not ready. Please wait and try again.');
                            return;
                          }
              
                          if (confirm('Are you sure you want to delete this message?')) {
                            try {
                              const response = await fetch(`/api/messages/${messageId}`, {
                                method: 'DELETE',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ token: currentToken })
                              });
              
                              const data = await response.json();
              
                              if (response.ok) {
                                // Reload messages after successful deletion
                                loadMessages();
                              } else {
                                alert(data.error || 'Failed to delete message');
                              }
                            } catch (error) {
                              console.error('Error:', error);
                              alert('Error deleting message');
                            }
                          }
                        });
                      });
                    })
                    .catch(error => {
                      console.error('Error fetching messages:', error);
                      messagesTable.innerHTML = `
                        <tr>
                          <td colspan="4" class="px-6 py-4 text-center text-red-600">Error loading messages</td>
                        </tr>
                      `;
                    });
                }
              
                // Initial load
                loadMessages();
              }
});