import "./globals.css";
import Navbar from "../components/navbar";

export const metadata = {
  title: "Prowider Mini Lead Distribution System",
  description: "Lead routing dashboard, request form, and testing tools",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
      </body>
    </html>
  );
}
