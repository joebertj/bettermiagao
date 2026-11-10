import { BrowserRouter as Router, Route, Routes } from 'react-router';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import ScrollToTop from './components/ui/ScrollToTop';
import Home from './pages/Home';
import Projects from './pages/Projects';
import People from './pages/People';
import About from './pages/About';

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Navbar />
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/people" element={<People />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Home />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}
