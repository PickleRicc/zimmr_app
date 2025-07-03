export default function Footer() {
  return (
    <footer className="bg-[#121212] border-t border-[#2a2a2a] text-white py-6 px-4 mt-8">
      <div className="container mx-auto max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0 flex items-center space-x-3">
            <img
              src="/images/ZIMMR_Logo_transparent.png"
              alt="ZIMMR Logo"
              className="h-7 w-auto md:h-8 max-w-[80px] md:max-w-[100px] object-contain drop-shadow-md transition-all duration-300"
              style={{ minWidth: '36px', maxHeight: '2rem' }}
              loading="eager"
              decoding="async"
            />
            <p className="text-sm md:text-base text-white/80">&copy; {new Date().getFullYear()} ZIMMR. All rights reserved.</p>
          </div>
          <div className="flex space-x-6 text-sm">
            <a href="#" className="text-white/70 hover:text-[#ffcb00] transition-colors duration-200">Privacy Policy</a>
            <a href="#" className="text-white/70 hover:text-[#ffcb00] transition-colors duration-200">Terms of Service</a>
            <a href="#" className="text-white/70 hover:text-[#ffcb00] transition-colors duration-200">Contact</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
