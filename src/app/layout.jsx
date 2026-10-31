import "../styles/app.css";

export const metadata = { title: "Lo Que Dijo la Gente" };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
