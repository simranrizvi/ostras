import './globals.css';

export const metadata = {
  title: { default: 'Ostras — Social Studio', template: '%s | Ostras' },
  description: 'Plan, create, and publish thoughtful social content for your brand.',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
