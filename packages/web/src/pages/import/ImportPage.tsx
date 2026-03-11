import { useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../api/client";
import { useStore } from "../../stores/StoreProvider";

type DataType = "inventory" | "recipes" | "suppliers" | "staff";
type Step = "select" | "upload" | "mapping" | "importing" | "done";

interface PreviewResult {
  totalRows: number;
  headers: string[];
  columnsDetected: Record<string, number>;
  availableFields: string[];
  missingRequired: string[];
  previewRows: Record<string, string>[];
}

interface ImportResult {
  message: string;
  imported: number;
  skipped: number;
  totalRows: number;
  errors: { row: number; reason: string }[];
  columnsUsed: string[];
}

const DATA_TYPES: { value: DataType; label: string; description: string; icon: string }[] = [
  { value: "inventory", label: "Inventory Items", description: "Products, ingredients, and supplies with quantities and costs", icon: "M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" },
  { value: "recipes", label: "Menu / Recipes", description: "Menu items with selling prices and categories", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { value: "suppliers", label: "Suppliers / Vendors", description: "Supplier contacts and delivery schedules", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" },
  { value: "staff", label: "Staff / Employees", description: "Employee roster with roles and pay rates", icon: "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8z" },
];

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  category: "Category",
  quantity: "Quantity",
  unit: "Unit",
  costPerUnit: "Cost Per Unit",
  lowStockThreshold: "Low Stock Threshold",
  barcode: "Barcode",
  supplier: "Supplier",
  sellingPrice: "Selling Price",
  prepTime: "Prep Time",
  ingredients: "Ingredients",
  contactName: "Contact Name",
  contactEmail: "Email",
  contactPhone: "Phone",
  deliverySchedule: "Delivery Schedule",
  email: "Email",
  role: "Role",
  phone: "Phone",
  hourlyRate: "Hourly Rate",
};

export function ImportPage() {
  const { selectedStoreId } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("select");
  const [dataType, setDataType] = useState<DataType | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [columnOverrides, setColumnOverrides] = useState<Record<string, number>>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: (params: { dataType: string; csvContent: string }) =>
      api.importPreview(selectedStoreId!, params),
    onSuccess: (data: PreviewResult) => {
      setPreview(data);
      setColumnOverrides({});
      setStep("mapping");
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: (params: { dataType: string; csvContent: string; columnOverrides?: Record<string, number> }) =>
      api.importData(selectedStoreId!, params),
    onSuccess: (data: ImportResult) => {
      setImportResult(data);
      setStep("done");
    },
  });

  // File handling
  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvContent(text);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleUploadNext = () => {
    if (!dataType || !csvContent || !selectedStoreId) return;
    previewMutation.mutate({ dataType, csvContent });
  };

  const handleImport = () => {
    if (!dataType || !csvContent || !selectedStoreId) return;
    setStep("importing");
    const overrides = Object.keys(columnOverrides).length > 0 ? columnOverrides : undefined;
    importMutation.mutate({ dataType, csvContent, columnOverrides: overrides });
  };

  const handleReset = () => {
    setStep("select");
    setDataType(null);
    setCsvContent("");
    setFileName("");
    setPreview(null);
    setColumnOverrides({});
    setImportResult(null);
    previewMutation.reset();
    importMutation.reset();
  };

  const handleColumnChange = (field: string, headerIndex: number) => {
    setColumnOverrides((prev) => ({
      ...prev,
      [field]: headerIndex,
    }));
  };

  // Merge auto-detected + overrides for display
  const effectiveColumns = preview
    ? { ...preview.columnsDetected, ...columnOverrides }
    : {};

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Import Data</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Upload a spreadsheet (CSV or Excel exported as CSV) to bulk import your data
        </p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { key: "select", label: "1. Choose Type" },
          { key: "upload", label: "2. Upload File" },
          { key: "mapping", label: "3. Map Columns" },
          { key: "done", label: "4. Import" },
        ].map((s, i) => {
          const stepOrder = ["select", "upload", "mapping", "done"];
          const currentIdx = stepOrder.indexOf(step === "importing" ? "done" : step);
          const thisIdx = stepOrder.indexOf(s.key);
          const isActive = thisIdx === currentIdx;
          const isDone = thisIdx < currentIdx;

          return (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <div className={`w-8 h-px ${isDone || isActive ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-600"}`} />}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : isDone
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
              }`}>
                {isDone ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                ) : null}
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      <div className="max-w-4xl">
        {/* Step 1: Select data type */}
        {step === "select" && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">What are you importing?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {DATA_TYPES.map((dt) => (
                <button
                  key={dt.value}
                  onClick={() => { setDataType(dt.value); setStep("upload"); }}
                  className={`flex items-start gap-4 p-5 rounded-xl border-2 transition-all text-left hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 ${
                    dataType === dt.value
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  }`}
                >
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={dt.icon} />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{dt.label}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{dt.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Upload file */}
        {step === "upload" && dataType && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Upload your {DATA_TYPES.find((d) => d.value === dataType)?.label} file
              </h2>
              <button onClick={() => setStep("select")} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                Back
              </button>
            </div>

            {/* Download template */}
            <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              <div className="flex-1">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Not sure about the format? Download our template, fill it in, and upload it back.
                </p>
              </div>
              <a
                href={api.getImportTemplate(selectedStoreId!, dataType)}
                download
                className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
              >
                Download Template
              </a>
            </div>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                csvContent
                  ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/10"
                  : "border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.tsv"
                onChange={handleFileSelect}
                className="hidden"
              />
              {csvContent ? (
                <>
                  <svg className="w-12 h-12 text-emerald-500 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{fileName}</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">File loaded. Click "Next" to continue, or drop a new file to replace.</p>
                </>
              ) : (
                <>
                  <svg className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Drop your CSV file here</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">or click to browse. Supports .csv files.</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
                    Tip: In Excel or Google Sheets, go to File &gt; Download as &gt; CSV
                  </p>
                </>
              )}
            </div>

            {csvContent && (
              <div className="flex justify-end">
                <button
                  onClick={handleUploadNext}
                  disabled={previewMutation.isPending}
                  className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {previewMutation.isPending ? "Analyzing..." : "Next: Map Columns"}
                </button>
              </div>
            )}

            {previewMutation.isError && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-sm text-red-700 dark:text-red-300">{(previewMutation.error as Error).message}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Column mapping */}
        {step === "mapping" && preview && dataType && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Map Your Columns</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  We auto-detected {Object.keys(preview.columnsDetected).length} of {preview.availableFields.length} fields from {preview.totalRows} rows. Adjust if needed.
                </p>
              </div>
              <button onClick={() => setStep("upload")} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                Back
              </button>
            </div>

            {preview.missingRequired.length > 0 && Object.keys(columnOverrides).length === 0 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Could not auto-detect required column(s): <strong>{preview.missingRequired.join(", ")}</strong>. Please map them below.
                </p>
              </div>
            )}

            {/* Column mapping table */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-700/50">
                    <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-4 py-3">Field</th>
                    <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-4 py-3">Your Column</th>
                    <th className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {preview.availableFields.map((field) => {
                    const mappedIdx = effectiveColumns[field];
                    const isMapped = mappedIdx !== undefined;
                    const isRequired = (field === "name");

                    return (
                      <tr key={field} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {FIELD_LABELS[field] || field}
                          </span>
                          {isRequired && <span className="text-red-500 ml-1">*</span>}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={isMapped ? mappedIdx : ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === "") {
                                const next = { ...columnOverrides };
                                delete next[field];
                                setColumnOverrides(next);
                              } else {
                                handleColumnChange(field, parseInt(val));
                              }
                            }}
                            className="w-full border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">-- Skip --</option>
                            {preview.headers.map((h, idx) => (
                              <option key={idx} value={idx}>{h}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {isMapped ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-full">
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                              Mapped
                            </span>
                          ) : isRequired ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-full">
                              Required
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Optional</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Preview data */}
            {preview.previewRows.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Preview (first {preview.previewRows.length} rows)</h3>
                <div className="overflow-x-auto bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-700/50">
                        {Object.keys(effectiveColumns).map((field) => (
                          <th key={field} className="text-left text-xs font-semibold text-slate-500 dark:text-slate-400 px-3 py-2 whitespace-nowrap">
                            {FIELD_LABELS[field] || field}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {preview.previewRows.map((row, i) => (
                        <tr key={i}>
                          {Object.keys(effectiveColumns).map((field) => (
                            <td key={field} className="px-3 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                              {row[field] || <span className="text-slate-300 dark:text-slate-600">--</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {preview.totalRows} rows will be imported
              </p>
              <button
                onClick={handleImport}
                disabled={importMutation.isPending}
                className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Import {preview.totalRows} {dataType === "inventory" ? "Items" : dataType === "recipes" ? "Recipes" : dataType === "suppliers" ? "Suppliers" : "Staff"}
              </button>
            </div>

            {importMutation.isError && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-sm text-red-700 dark:text-red-300">{(importMutation.error as Error).message}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3.5: Importing... */}
        {step === "importing" && (
          <div className="text-center py-16">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Importing your data...</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">This may take a moment for large files</p>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && importResult && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5" /></svg>
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Import Complete</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{importResult.message}</p>
            </div>

            {/* Results summary */}
            <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
              <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{importResult.imported}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Imported</p>
              </div>
              <div className="text-center p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{importResult.skipped}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Skipped</p>
              </div>
              <div className="text-center p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{importResult.totalRows}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total Rows</p>
              </div>
            </div>

            {/* Errors list */}
            {importResult.errors.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  Skipped Rows ({importResult.errors.length})
                </h3>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {importResult.errors.map((err, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-slate-400 dark:text-slate-500 font-mono text-xs">Row {err.row}</span>
                      <span className="text-slate-600 dark:text-slate-400">{err.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={handleReset}
                className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Import More Data
              </button>
              <a
                href={dataType === "inventory" ? "/inventory" : dataType === "staff" ? "/team" : "/"}
                className="px-6 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                View {DATA_TYPES.find((d) => d.value === dataType)?.label}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
