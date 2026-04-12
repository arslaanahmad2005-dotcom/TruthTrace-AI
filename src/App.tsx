import React, { useState, useRef, useEffect } from "react";
import { 
  Shield, 
  Upload, 
  Image as ImageIcon, 
  FileText, 
  CreditCard, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Loader2, 
  Info,
  ChevronRight,
  Search,
  Zap
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import { analyzeWithGemini } from "./lib/gemini";

type AnalysisType = "image" | "document" | "payment";

interface AnalysisResult {
  verdict: "REAL" | "FAKE" | "SUSPICIOUS";
  confidence: number;
  explanation: string;
  anomalies: string[];
  heatmapPoints: { x: number; y: number; intensity: number }[];
  backendFeatures: any;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AnalysisType>("image");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkApi = async () => {
      try {
        const res = await fetch("/api/ping");
        if (res.ok) setApiStatus("online");
        else setApiStatus("offline");
      } catch (e) {
        setApiStatus("offline");
      }
    };
    checkApi();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const selectedFile = e.dataTransfer.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const analyze = async () => {
    if (!file || !preview) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append(activeTab === "image" ? "image" : activeTab === "document" ? "document" : "payment", file);
      
      // 1. Call Backend for raw features
      console.log(`Fetching analysis from: /api/analyze/${activeTab}`);
      const backendRes = await fetch(`/api/analyze/${activeTab}`, {
        method: "POST",
        body: formData,
      });
      
      console.log(`Backend response status: ${backendRes.status}`);
      
      const contentType = backendRes.headers.get("content-type");
      if (!backendRes.ok) {
        let errorMessage = "Backend analysis failed";
        try {
          if (contentType && contentType.includes("application/json")) {
            const errorData = await backendRes.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } else {
            const text = await backendRes.text();
            console.error("Non-JSON error response:", text);
            errorMessage = `Server Error (${backendRes.status}): ${text.substring(0, 100)}...`;
          }
        } catch (e) {
          errorMessage = `Server Error (${backendRes.status})`;
        }
        throw new Error(errorMessage);
      }
      
      if (!contentType || !contentType.includes("application/json")) {
        const text = await backendRes.text();
        console.error("Invalid response format:", text);
        throw new Error(`Server returned an invalid response format (${backendRes.status}). Expected JSON but got ${contentType || 'unknown'}.`);
      }

      const backendData = await backendRes.json();
      
      // 2. Call Gemini for AI verdict
      // For payment, we pass the structured backend analysis to Gemini
      const aiResult = await analyzeWithGemini(
        activeTab,
        preview,
        file.type,
        activeTab === "payment" ? {
          backendVerdict: backendData.result,
          backendConfidence: backendData.confidence_score,
          backendExplanation: backendData.explanation,
          ...backendData.features
        } : backendData.features
      );
      
      setResult({
        ...aiResult,
        backendFeatures: activeTab === "payment" ? {
          verdict: backendData.result,
          score: backendData.confidence_score,
          ...backendData.features
        } : backendData.features
      });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An error occurred during analysis. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30">
      {/* Header */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center neon-glow">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tighter uppercase italic">TruthTrace AI</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/60">
          <a href="#" className="hover:text-white transition-colors">Technology</a>
          <a href="#" className="hover:text-white transition-colors">Enterprise</a>
          <a href="#" className="hover:text-white transition-colors">API</a>
          <button className="px-4 py-2 bg-white text-black rounded-full text-xs font-bold hover:bg-white/90 transition-colors">
            GET STARTED
          </button>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6 max-w-6xl mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold mb-6"
          >
            <Zap className="w-3 h-3" />
            POWERED BY GEMINI 3 FLASH
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tighter mb-6"
          >
            DETECT THE <span className="text-blue-500">INVISIBLE.</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-white/40 text-lg max-w-2xl mx-auto"
          >
            Advanced forensic analysis for images, documents, and fintech proofs. 
            Unmask deepfakes and forgeries with ensemble AI logic.
          </motion.p>
        </div>

        {/* Main Interface */}
        <div className="grid lg:grid-cols-12 gap-8">
          {/* Left Column: Upload & Controls */}
          <div className="lg:col-span-7 space-y-6">
            {/* Tabs */}
            <div className="flex p-1 bg-white/5 rounded-2xl border border-white/10">
              {(["image", "document", "payment"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); reset(); }}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
                    activeTab === tab 
                      ? "bg-white text-black shadow-xl" 
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  )}
                >
                  {tab === "image" && <ImageIcon className="w-4 h-4" />}
                  {tab === "document" && <FileText className="w-4 h-4" />}
                  {tab === "payment" && <CreditCard className="w-4 h-4" />}
                  <span className="capitalize">{tab}</span>
                </button>
              ))}
            </div>

            {/* Upload Area */}
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={cn(
                "relative aspect-video rounded-3xl border-2 border-dashed transition-all flex flex-col items-center justify-center overflow-hidden",
                preview ? "border-transparent" : "border-white/10 hover:border-blue-500/50 bg-white/[0.02]",
                isAnalyzing && "animate-pulse"
              )}
            >
              {preview ? (
                <>
                  <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                  {/* Heatmap Overlay Simulation */}
                  {result?.heatmapPoints && (
                    <div className="absolute inset-0 pointer-events-none">
                      {result.heatmapPoints.map((p, i) => (
                        <div 
                          key={i}
                          className="absolute rounded-full bg-red-500/40 blur-xl animate-pulse"
                          style={{ 
                            left: `${p.x}%`, 
                            top: `${p.y}%`, 
                            width: `${p.intensity * 100}px`, 
                            height: `${p.intensity * 100}px`,
                            transform: 'translate(-50%, -50%)'
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <button 
                    onClick={reset}
                    className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-full hover:bg-black transition-colors"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </>
              ) : (
                <div className="text-center p-8">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/10">
                    <Upload className="w-8 h-8 text-white/20" />
                  </div>
                  <p className="text-lg font-medium mb-1">Drop your {activeTab} here</p>
                  <p className="text-white/40 text-sm mb-6">Supports PNG, JPG, JPEG up to 10MB</p>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 bg-blue-600 rounded-full text-sm font-bold hover:bg-blue-500 transition-colors"
                  >
                    SELECT FILE
                  </button>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden" 
                accept="image/png,image/jpeg,image/jpg"
              />
            </div>

            {/* Action Button */}
            <div className="space-y-4">
              <button
                disabled={!file || isAnalyzing || apiStatus === "offline"}
                onClick={analyze}
                className={cn(
                  "w-full py-4 rounded-2xl text-lg font-bold transition-all flex items-center justify-center gap-3",
                  !file || isAnalyzing || apiStatus === "offline"
                    ? "bg-white/5 text-white/20 cursor-not-allowed" 
                    : "bg-white text-black hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_rgba(255,255,255,0.2)]"
                )}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    RUNNING FORENSIC ENGINES...
                  </>
                ) : (
                  <>
                    <Search className="w-6 h-6" />
                    RUN AUTHENTICITY CHECK
                  </>
                )}
              </button>

              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full animate-pulse",
                    apiStatus === "online" ? "bg-green-500" : 
                    apiStatus === "offline" ? "bg-red-500" : "bg-yellow-500"
                  )} />
                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                    System Status: {apiStatus === "online" ? "Operational" : apiStatus === "offline" ? "Connection Error" : "Checking..."}
                  </span>
                </div>
                {apiStatus === "offline" && (
                  <button 
                    onClick={() => window.location.reload()}
                    className="text-[10px] font-bold text-blue-400 uppercase tracking-widest hover:text-blue-300"
                  >
                    Retry Connection
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-5">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Verdict Card */}
                  <div className={cn(
                    "p-8 rounded-3xl border flex flex-col items-center text-center",
                    result.verdict === "REAL" ? "bg-green-500/10 border-green-500/20" :
                    result.verdict === "FAKE" ? "bg-red-500/10 border-red-500/20" :
                    "bg-yellow-500/10 border-yellow-500/20"
                  )}>
                    <div className={cn(
                      "w-20 h-20 rounded-full flex items-center justify-center mb-4",
                      result.verdict === "REAL" ? "bg-green-500 text-white shadow-[0_0_40px_rgba(34,197,94,0.4)]" :
                      result.verdict === "FAKE" ? "bg-red-500 text-white shadow-[0_0_40px_rgba(239,68,68,0.4)]" :
                      "bg-yellow-500 text-white shadow-[0_0_40px_rgba(234,179,8,0.4)]"
                    )}>
                      {result.verdict === "REAL" && <CheckCircle2 className="w-10 h-10" />}
                      {result.verdict === "FAKE" && <XCircle className="w-10 h-10" />}
                      {result.verdict === "SUSPICIOUS" && <AlertTriangle className="w-10 h-10" />}
                    </div>
                    <h2 className="text-3xl font-bold tracking-tighter mb-2 italic uppercase">
                      {result.verdict}
                    </h2>
                    <div className="flex items-center gap-2 text-white/60 text-sm font-medium">
                      <span>Confidence Score</span>
                      <span className="text-white font-bold">{result.confidence}%</span>
                    </div>
                    
                    {/* Confidence Bar */}
                    <div className="w-full h-2 bg-white/5 rounded-full mt-4 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${result.confidence}%` }}
                        className={cn(
                          "h-full rounded-full",
                          result.verdict === "REAL" ? "bg-green-500" :
                          result.verdict === "FAKE" ? "bg-red-500" :
                          "bg-yellow-500"
                        )}
                      />
                    </div>
                  </div>

                  {/* Explanation Card */}
                  <div className="glass p-6 rounded-3xl space-y-4">
                    <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-widest">
                      <Info className="w-4 h-4" />
                      Forensic Explanation
                    </div>
                    <p className="text-white/70 leading-relaxed italic">
                      "{result.explanation}"
                    </p>
                    
                    {result.anomalies.length > 0 && (
                      <div className="space-y-2 pt-4 border-t border-white/5">
                        <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Detected Anomalies</div>
                        {result.anomalies.map((anomaly, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm text-red-400/80">
                            <ChevronRight className="w-4 h-4 mt-0.5 shrink-0" />
                            <span>{anomaly}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Backend Features Card */}
                  <div className="glass p-6 rounded-3xl">
                    <div className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-4">Raw Signal Analysis</div>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(result.backendFeatures).map(([key, value]: [string, any]) => (
                        <div key={key} className="p-3 bg-white/[0.02] rounded-xl border border-white/5">
                          <div className="text-[10px] text-white/40 uppercase mb-1">{key.replace(/([A-Z])/g, ' $1')}</div>
                          <div className="font-mono text-xs truncate">
                            {typeof value === 'object' ? JSON.stringify(value).substring(0, 20) + '...' : String(value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-12 glass rounded-3xl border-dashed">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6">
                    <Search className="w-8 h-8 text-white/10" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Awaiting Input</h3>
                  <p className="text-white/30 text-sm">
                    Upload a file and run the analysis to see forensic results here.
                  </p>
                </div>
              )}
            </AnimatePresence>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm flex items-center gap-3"
              >
                <AlertTriangle className="w-5 h-5" />
                {error}
              </motion.div>
            )}
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-32 grid md:grid-cols-3 gap-8">
          {[
            { title: "Frequency Analysis", desc: "Detects abnormal pixel distributions and compression artifacts using FFT-like signals." },
            { title: "Deepfake Detection", desc: "Advanced facial consistency checks to identify AI-generated personas and face swaps." },
            { title: "Template Matching", desc: "Verifies UI elements against known legitimate fintech and document templates." }
          ].map((f, i) => (
            <div key={i} className="p-8 glass rounded-3xl hover:bg-white/[0.08] transition-colors cursor-default group">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-blue-500" />
              </div>
              <h4 className="text-xl font-bold mb-3 tracking-tight">{f.title}</h4>
              <p className="text-white/40 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 px-6 text-center text-white/20 text-xs font-medium tracking-widest uppercase">
        &copy; 2026 TRUTHTRACE AI FORENSICS. ALL RIGHTS RESERVED.
      </footer>
    </div>
  );
}
