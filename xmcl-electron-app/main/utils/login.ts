export function getLoginSuccessHTML(title: string, body: string) {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background-color: #f0f0f0;
      font-family: Arial, sans-serif;
    }
    .message {
      text-align: center;
    }
  </style>
  </head>
  <body>
  <div class="message">
    <h1>${title}</h1>
    <p>${body}</p>
  </div>
  
  <script>
    let countdownTime = 10;
    let countdownElement = document.getElementById('countdown');
  
    function updateCountdown() {
      countdownElement.textContent = countdownTime;
      countdownTime--;
      if (countdownTime < 0) {
        window.close();
      } else {
        setTimeout(updateCountdown, 1000);
      }
    }
  
    updateCountdown();
  </script>
  </body>
  </html>`
}
