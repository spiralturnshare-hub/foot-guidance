export default function MangaViewer() {
  return (
    <div className="flex flex-col h-screen w-full bg-gray-100">
      <div className="flex-1 overflow-y-auto flex flex-col items-center p-4">
        <div className="w-full max-w-2xl bg-white shadow-lg rounded-xl overflow-hidden">
          {/* Placeholder for manga images */}
          <img
            src="https://via.placeholder.com/800x1200"
            alt="Manga Page"
            className="w-full h-auto block"
          />
        </div>
      </div>
      <div className="p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg text-xl shadow-lg">
          音声ガイドを再生
        </button>
      </div>
    </div>
  );
}
