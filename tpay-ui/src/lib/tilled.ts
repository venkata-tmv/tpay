declare global {
  interface Window {
    Tilled?: any;
  }
}

export async function loadTilledJs(): Promise<any> {
  if (window.Tilled) return window.Tilled;

  await new Promise<void>((resolve, reject) => {
    
    const s = document.createElement("script");
    s.src = "https://js.tilled.com/v2";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load card SDK."));
    document.body.appendChild(s);
  });

  if (!window.Tilled) throw new Error("Card SDK loaded but client object missing.");
  return window.Tilled;
}
