import MobileNavbar from '../../components/MobileNavbar';

export default function NewQuoteLayout({ children }) {
  return (
    <>
      {children}
      <MobileNavbar />
    </>
  );
}
