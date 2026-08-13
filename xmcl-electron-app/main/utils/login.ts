export function getLoginSuccessHTML(title: string) {
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light dark">
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: "Segoe UI Variable", "Segoe UI", sans-serif;
        background: #e8efec;
        color: #17231e;
      }

      * {
        box-sizing: border-box;
      }

      body {
        display: grid;
        min-height: 100vh;
        margin: 0;
        padding: 24px;
        place-items: center;
        background-color: #e8efec;
        background-image:
          linear-gradient(rgba(30, 74, 56, 0.055) 1px, transparent 1px),
          linear-gradient(90deg, rgba(30, 74, 56, 0.055) 1px, transparent 1px);
        background-size: 28px 28px;
      }

      .message {
        width: min(100%, 540px);
        overflow: hidden;
        border: 1px solid rgba(33, 69, 54, 0.18);
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 24px 70px rgba(20, 49, 37, 0.14);
        animation: appear 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }

      .brand {
        display: flex;
        align-items: center;
        min-height: 52px;
        padding: 0 24px;
        border-bottom: 1px solid #e2e9e6;
        color: #496158;
        font-size: 13px;
        font-weight: 650;
        letter-spacing: 0;
      }

      .brand-mark {
        width: 10px;
        height: 10px;
        margin-right: 10px;
        background: #238659;
        box-shadow: 4px 4px 0 #b7dd5c;
      }

      .content {
        padding: 42px 38px 40px;
        text-align: center;
      }

      .success-icon {
        display: grid;
        width: 72px;
        height: 72px;
        margin: 0 auto 28px;
        border: 1px solid #a9d5bd;
        border-radius: 50%;
        place-items: center;
        background: #e7f6ed;
        color: #157447;
      }

      .success-icon::after {
        width: 25px;
        height: 13px;
        border-bottom: 4px solid currentColor;
        border-left: 4px solid currentColor;
        content: "";
        transform: translateY(-3px) rotate(-45deg);
      }

      h1 {
        margin: 0;
        color: #17231e;
        font-size: 28px;
        font-weight: 700;
        line-height: 1.25;
        letter-spacing: 0;
        overflow-wrap: anywhere;
      }

      @keyframes appear {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
      }

      @media (max-width: 480px) {
        body {
          padding: 16px;
        }

        .brand {
          padding: 0 20px;
        }

        .content {
          padding: 34px 24px 32px;
        }

        h1 {
          font-size: 23px;
        }
      }

      @media (max-height: 500px) {
        body {
          padding: 12px;
        }

        .brand {
          min-height: 44px;
        }

        .content {
          padding: 24px 32px 22px;
        }

        .success-icon {
          width: 56px;
          height: 56px;
          margin-bottom: 18px;
        }

        .success-icon::after {
          width: 20px;
          height: 11px;
          border-width: 0 0 3px 3px;
        }

        h1 {
          font-size: 24px;
        }

      }

      @media (prefers-color-scheme: dark) {
        :root {
          background: #101713;
          color: #edf4f0;
        }

        body {
          background-color: #101713;
          background-image:
            linear-gradient(rgba(184, 220, 203, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(184, 220, 203, 0.045) 1px, transparent 1px);
        }

        .message {
          border-color: #33453d;
          background: #19231e;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.32);
        }

        .brand {
          border-color: #2d3c35;
          color: #a9bbb2;
        }

        .success-icon {
          border-color: #356a50;
          background: #1d3b2c;
          color: #72d09d;
        }

        h1 {
          color: #f1f6f3;
        }

      }

      @media (prefers-reduced-motion: reduce) {
        .message {
          animation: none;
        }
      }
    </style>
  </head>
  <body>
    <main class="message">
      <div class="brand"><span class="brand-mark" aria-hidden="true"></span>X Minecraft Launcher</div>
      <div class="content">
        <div class="success-icon" aria-hidden="true"></div>
        <h1>${title}</h1>
      </div>
    </main>
  </body>
  </html>`
}
