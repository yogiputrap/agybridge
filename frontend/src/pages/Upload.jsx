import { AlertCircle, CheckCircle2, FileJson, FileText, Upload, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import { Badge, Button, Card, CardHeader, CodeBlock, IconButton, Notice } from "../components/ui";
import api from "../api";

export default function UploadPage() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const addFiles = (fileList) => {
    const valid = Array.from(fileList).filter(
      (f) => f.name.endsWith(".json") || f.name.endsWith(".zip")
    );
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...valid.filter((f) => !names.has(f.name))];
    });
    setResults(null);
  };

  const removeFile = (name) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const upload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setResults(null);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));

      const res = await api.post("/creds/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResults(res.data);
    } catch (err) {
      setResults({
        error: err.response?.data?.detail || "Gagal mengunggah berkas",
      });
    } finally {
      setUploading(false);
    }
  };

  const successCount = results?.uploaded_count || 0;
  const totalCount = results?.total_count || 0;
  const failed = results?.results?.filter((r) => r.status === "error") || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      {/* Main column: dropzone, selected files, results */}
      <div className="lg:col-span-2 space-y-4 min-w-0">
        <Card>
          <CardHeader
            icon={Upload}
            title="Impor Kredensial Massal"
            subtitle="Mendukung berkas kredensial Antigravity (.json atau arsip .zip berisi berkas JSON)."
          />
          {/* Area Unggah */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Pilih berkas kredensial"
            className={`border-2 border-dashed rounded-2xl px-4 py-10 sm:py-12 text-center cursor-pointer transition-colors ${
              dragOver
                ? "border-purple-500 bg-purple-600/10"
                : "border-dark-600 bg-dark-800/50 hover:border-purple-500/60 hover:bg-dark-800"
            }`}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              addFiles(e.dataTransfer.files);
            }}
          >
            <span className="w-14 h-14 rounded-full bg-purple-600/10 text-purple-500 flex items-center justify-center mx-auto mb-4">
              <Upload size={24} />
            </span>
            <p className="text-base font-medium text-ink">Klik untuk memilih berkas atau seret berkas ke sini</p>
            <p className="text-gray-400 text-sm mt-1.5 max-w-md mx-auto">
              Mendukung format .json dan .zip (arsip zip akan diekstrak otomatis)
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".json,.zip"
              className="hidden"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </Card>

        {/* Daftar Berkas */}
        {files.length > 0 && (
          <Card>
            <CardHeader
              icon={FileText}
              title={`${files.length} berkas dipilih`}
              subtitle="Periksa daftar lalu unggah untuk mengimpor."
              className="!mb-4"
              action={
                <>
                  <Button variant="primary" onClick={upload} loading={uploading} icon={Upload}>
                    {uploading ? "Mengunggah..." : "Unggah Berkas"}
                  </Button>
                  <Button variant="secondary" onClick={() => setFiles([])} disabled={uploading}>
                    Kosongkan
                  </Button>
                </>
              }
            />
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {files.map((f) => (
                <div
                  key={f.name}
                  className="flex items-center justify-between gap-3 bg-dark-800 border border-dark-700/60 rounded-xl pl-3 pr-1.5 py-1.5 text-sm"
                >
                  <div className="flex items-center gap-2.5 text-gray-300 min-w-0">
                    <FileJson size={16} className="text-purple-500 shrink-0" />
                    <span className="truncate" title={f.name}>
                      {f.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-gray-400 text-xs whitespace-nowrap">{(f.size / 1024).toFixed(1)} KB</span>
                    <IconButton
                      icon={XCircle}
                      label={`Hapus ${f.name}`}
                      tone="danger"
                      className="!bg-transparent"
                      onClick={() => removeFile(f.name)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Hasil Unggah */}
        {results && (
          <Card>
            <CardHeader
              icon={results.error ? AlertCircle : CheckCircle2}
              title="Hasil Impor"
              className="!mb-4"
              action={
                !results.error && (
                  <>
                    <Badge tone="success" dot>
                      {successCount} berhasil
                    </Badge>
                    {failed.length > 0 && (
                      <Badge tone="danger" dot>
                        {failed.length} gagal
                      </Badge>
                    )}
                  </>
                )
              }
            />
            {results.error ? (
              <Notice tone="danger" icon={AlertCircle}>
                {results.error}
              </Notice>
            ) : (
              <div className="space-y-4">
                <Notice tone="success" icon={CheckCircle2}>
                  {results.message || `Selesai: Berhasil mengunggah ${successCount}/${totalCount} berkas`}
                </Notice>
                {failed.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-ink mb-2">Rincian Gagal</div>
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {failed.map((r, i) => (
                        <div
                          key={i}
                          className="rounded-xl bg-red-500/10 border border-red-500/20 px-3.5 py-2.5 text-sm min-w-0"
                        >
                          <div className="font-medium text-ink break-all">{r.filename}</div>
                          <div className="text-red-600 dark:text-red-400 text-xs mt-0.5 break-words">{r.message}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Side column: format reference */}
      <div className="min-w-0">
        <Card>
          <CardHeader icon={FileJson} title="Format JSON Baku" subtitle="Struktur berkas kredensial yang diterima." />
          <CodeBlock maxHeight={360}>{`{
  "refresh_token": "Wajib",
  "access_token": "Opsional (langsung digunakan jika belum expired)",
  "expiry": "Opsional (waktu kadaluarsa access_token)",
  "email": "Opsional (diambil otomatis jika kosong)",
  "tier": "Opsional (diambil otomatis jika kosong)",
  "project_id": "Opsional (diambil otomatis jika kosong)"
}`}</CodeBlock>
          <p className="mt-4 text-sm text-gray-400">
            Kredensial dengan refresh_token tidak valid akan gagal; kredensial dengan email sama akan diperbarui otomatis.
          </p>
        </Card>
      </div>
    </div>
  );
}
