export function getLoginSuccessHTML(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  * {
    box-sizing: border-box;
  }
  body {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    margin: 0;
    background-color: #141414;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #ffffff;
    user-select: none;
    overflow: hidden;
  }
  .card {
    text-align: center;
    background-color: #212121;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 16px;
    padding: 36px 32px 32px;
    max-width: 440px;
    width: 90%;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  }
  .icon-wrapper {
    width: 60px;
    height: 60px;
    margin: 0 auto 20px;
    border-radius: 50%;
    background-color: rgba(76, 175, 80, 0.12);
    border: 1px solid rgba(76, 175, 80, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .icon-wrapper svg {
    width: 30px;
    height: 30px;
    color: #4caf50;
  }
  h1 {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 10px;
    letter-spacing: -0.2px;
    color: #ffffff;
    line-height: 1.4;
  }
  p {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.65);
    margin: 0 0 24px;
    line-height: 1.5;
  }
  #countdown {
    display: inline-block;
    padding: 2px 7px;
    background-color: rgba(76, 175, 80, 0.12);
    border: 1px solid rgba(76, 175, 80, 0.25);
    border-radius: 6px;
    color: #4caf50;
    font-weight: 600;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12px;
  }
  .btn-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    padding: 0 20px;
    border-radius: 8px;
    background-color: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #ffffff;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease, border-color 0.2s ease;
    text-decoration: none;
  }
  .btn-close:hover {
    background-color: rgba(255, 255, 255, 0.14);
    border-color: rgba(255, 255, 255, 0.2);
  }
</style>
</head>
<body>
<div class="card">
  <div class="icon-wrapper">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  </div>
  <h1>${title}</h1>
  <p>${body}</p>
  <button class="btn-close" onclick="window.close()">Close Window</button>
</div>

<script>
  let countdownTime = 10;
  let countdownElement = document.getElementById('countdown');

  function updateCountdown() {
    if (countdownElement) countdownElement.textContent = countdownTime;
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
