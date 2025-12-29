import React, {
  useState,
  useRef,
  useEffect
} from "react";

import {
  Upload,
  Download,
  Loader2,
  Image as ImageIcon,
  Sparkles,
  Calendar as CalendarIcon
} from "lucide-react";

import { GenerateResponse } from "./types";



const OUTFIT_OPTIONS = [
  "Vest nữ tối màu sang trọng (blazer cao cấp, phong thái CEO)",
  "Vest trắng thanh lịch (blazer trắng kem, tối giản)",
  "Đầm công sở cao cấp (tối màu, form chuẩn)",
  "Áo dài doanh nhân (trang nhã, cao cấp)",
  "Tùy chọn khác..."
];

const STYLE_OPTIONS = [
  "Giữ nguyên như ảnh tham chiếu (khuyến nghị)",
  "Có kính, phong thái tri thức",
  "Trang điểm nhẹ kiểu doanh nhân",
  "Tóc giữ nguyên, ánh sáng studio mềm"
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'nameplate' | 'calendar'>('nameplate');
  const [name, setName] = useState('');
  const [job, setJob] = useState('');
  const [phone, setPhone] = useState('');
  const [outfit, setOutfit] = useState(OUTFIT_OPTIONS[0]);
  const [customOutfit, _setCustomOutfit] = useState('');
  const [portraitStyle, setPortraitStyle] = useState(STYLE_OPTIONS[0]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gemini 3 models require mandatory API key selection
  const [hasSelectedKey, setHasSelectedKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkApiKey = async () => {
      if ((window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        setHasSelectedKey(hasKey);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenSelectKey = async () => {
    if ((window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      // Assume success after triggering the dialog to avoid race conditions
      setHasSelectedKey(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.type.match('image.*')) {
        setError('Vui lòng chỉ tải lên file ảnh (JPG, PNG).');
        return;
      }
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResultImage(null);

    if (activeTab === 'nameplate') {
      if (!name.trim()) return setError('Vui lòng nhập Họ và Tên.');
      if (!phone.trim()) return setError('Vui lòng nhập Số điện thoại.');
    }
    if (!file) return setError('Vui lòng tải lên ảnh chân dung.');

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('mode', activeTab);
      formData.append('face', file);

      if (activeTab === 'nameplate') {
        formData.append('name', name.trim());
        formData.append('job', job.trim());
        formData.append('phone', phone.replace(/\s/g, ''));
        formData.append('outfit', outfit === "Tùy chọn khác..." ? customOutfit : outfit);
        formData.append('portraitStyle', portraitStyle);
      }

      const response = await fetch('/.netlify/functions/generate', {
        method: 'POST',
        body: formData,
      });

      const data: GenerateResponse = await response.json();
      if (!response.ok) {
        // If the request fails with "Requested entity was not found.", prompt to re-select API Key
        if (data.error?.includes("Requested entity was not found")) {
          setHasSelectedKey(false);
          await handleOpenSelectKey();
          return;
        }
        throw new Error(data.error || 'Lỗi tạo ảnh.');
      }

      const finalImage = data.image_base64 ? `data:image/png;base64,${data.image_base64}` : data.image_url;
      setResultImage(finalImage || null);
    } catch (err: any) {
      setError(err.message || "Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (resultImage) {
      const link = document.createElement('a');
      link.href = resultImage;
      link.download = `trend-${activeTab}-${Date.now()}.png`;
      link.click();
    }
  };

  // UI for API Key selection requirement
  if (hasSelectedKey === false) {
    return (
      <div className="min-h-screen bg-[#0f0d0c] flex items-center justify-center p-4">
        <div className="bg-[#1a1614] border border-amber-900/40 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
          <Sparkles className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black uppercase tracking-widest text-amber-400 mb-2">Yêu cầu API Key</h2>
          <p className="text-amber-200/60 mb-8 text-sm leading-relaxed">
            Để sử dụng mô hình tạo ảnh cao cấp <strong>Gemini 3 Pro</strong>, bạn cần chọn API Key cá nhân từ dự án Google Cloud có trả phí.
          </p>
          <button 
            onClick={handleOpenSelectKey}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-700 text-black font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] transition-all shadow-lg mb-6"
          >
            Chọn API Key
          </button>
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-amber-600 hover:text-amber-500 text-xs font-bold underline"
          >
            Tìm hiểu về Billing & API Key
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0d0c] text-amber-50 font-sans">
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-12">
        <header className="mb-8 text-center">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600 bg-clip-text text-transparent mb-2 tracking-tighter">
            Tạo ảnh Trend
          </h1>
          <p className="text-amber-200/40 text-sm uppercase tracking-[0.3em] font-medium">
            Kho ứng dụng sáng tạo AI
          </p>
        </header>

        {/* Tab Switcher */}
        <div className="flex justify-center mb-8">
          <div className="bg-[#1e1b19] p-1 rounded-lg border border-amber-900/30 flex gap-1">
            <button 
              onClick={() => { setActiveTab('nameplate'); setResultImage(null); }}
              className={`px-6 py-2 rounded-md text-sm font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'nameplate' ? 'bg-amber-600 text-black shadow-lg' : 'text-amber-500/50 hover:text-amber-400'}`}
            >
              <Sparkles className="w-4 h-4" /> Biển Chức Danh
            </button>
            <button 
              onClick={() => { setActiveTab('calendar'); setResultImage(null); }}
              className={`px-6 py-2 rounded-md text-sm font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'calendar' ? 'bg-amber-600 text-black shadow-lg' : 'text-amber-500/50 hover:text-amber-400'}`}
            >
              <CalendarIcon className="w-4 h-4" /> Lịch 2026
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 bg-[#1a1614] border border-amber-900/20 p-6 md:p-8 rounded-xl shadow-2xl">
            <h2 className="text-lg font-bold text-amber-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              {activeTab === 'nameplate' ? 'Thông Tin Lãnh Đạo' : 'Kiến Tạo Lịch 2026'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div 
                className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${file ? 'border-amber-500/40 bg-amber-900/5' : 'border-amber-900/20 hover:border-amber-600/50'}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
                {preview ? (
                  <img src={preview} alt="Preview" className="w-24 h-32 mx-auto object-cover rounded-lg border border-amber-500/30 shadow-xl" />
                ) : (
                  <div className="py-4">
                    <Upload className="w-10 h-10 text-amber-700 mx-auto mb-2" />
                    <p className="text-sm text-amber-200/60">Tải ảnh chân dung rõ nét</p>
                  </div>
                )}
              </div>

              {activeTab === 'nameplate' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-amber-600 uppercase mb-1 block">Họ và Tên *</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-black/40 border border-amber-900/30 p-3 rounded-lg outline-none focus:border-amber-500 transition" placeholder="Nguyễn Văn A" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-amber-600 uppercase mb-1 block">Chức danh</label>
                    <input type="text" value={job} onChange={(e) => setJob(e.target.value)} className="w-full bg-black/40 border border-amber-900/30 p-3 rounded-lg outline-none focus:border-amber-500 transition" placeholder="Giám Đốc" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-amber-600 uppercase mb-1 block">Số điện thoại *</label>
                    <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))} className="w-full bg-black/40 border border-amber-900/30 p-3 rounded-lg outline-none focus:border-amber-500 transition font-mono" placeholder="0988xxxxxx" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-amber-600 uppercase mb-1 block">Trang phục</label>
                      <select value={outfit} onChange={(e) => setOutfit(e.target.value)} className="w-full bg-black/40 border border-amber-900/30 p-3 rounded-lg text-sm outline-none">
                        {OUTFIT_OPTIONS.map(o => <option key={o} value={o}>{o.split('(')[0]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-amber-600 uppercase mb-1 block">Phong cách</label>
                      <select value={portraitStyle} onChange={(e) => setPortraitStyle(e.target.value)} className="w-full bg-black/40 border border-amber-900/30 p-3 rounded-lg text-sm outline-none">
                        {STYLE_OPTIONS.map(s => <option key={s} value={s}>{s.split('(')[0]}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'calendar' && (
                <div className="p-4 bg-amber-900/10 border border-amber-900/20 rounded-lg text-xs text-amber-200/60 leading-relaxed italic">
                  Hệ thống AI sẽ tự động phân tích khuôn mặt, hoàn thiện trang phục lịch sự và ghép vào bối cảnh quán cà phê đêm sang trọng cùng bộ lịch năm 2026.
                </div>
              )}

              {error && <p className="text-red-400 text-xs text-center">{error}</p>}

              <button 
                type="submit" 
                disabled={loading}
                className={`w-full py-4 rounded-xl font-black uppercase tracking-widest transition-all ${loading ? 'bg-amber-900/20 text-amber-800' : 'bg-gradient-to-r from-amber-500 to-amber-700 text-black hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-amber-900/20'}`}
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'Bắt Đầu Chế Tác'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-[#1a1614] border border-amber-900/20 p-4 rounded-xl flex flex-col min-h-[500px] relative shadow-inner">
            {resultImage ? (
              <div className="flex-1 flex flex-col items-center justify-center p-4">
                <img src={resultImage} alt="Kết quả" className="max-w-full max-h-[70vh] rounded-lg shadow-2xl border border-amber-900/30" />
                <button onClick={handleDownload} className="mt-6 flex items-center gap-2 bg-amber-600 px-8 py-3 rounded-full text-black font-bold uppercase text-sm hover:bg-amber-500 transition-colors">
                  <Download className="w-4 h-4" /> Tải ảnh gốc
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
                {loading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="w-16 h-16 bg-amber-600 rounded-full mx-auto" />
                    <p className="text-amber-500 font-bold uppercase tracking-widest">Đang vẽ tranh bằng AI...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <ImageIcon className="w-20 h-20 text-amber-900 mx-auto" />
                    <p className="text-amber-800 font-bold uppercase tracking-[0.2em]">Preview Area</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;