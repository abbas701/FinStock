import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";

export default function Import() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const importMutation = trpc.import.excel.useMutation();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
        toast.error("Please select an Excel file (.xlsx or .xls)");
        return;
      }
      setFile(selectedFile);
      setImportResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setIsImporting(true);
    setImportResult(null);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64Data = (e.target?.result as string).split(",")[1];
          const result = await importMutation.mutateAsync({
            fileData: base64Data,
            filename: file.name,
          });

          setImportResult(result);
          if (result.success) {
            toast.success(result.message);
          } else {
            toast.error(result.message);
          }
        } catch (error: any) {
          toast.error(error.message || "Failed to import file");
          setImportResult({
            success: false,
            message: error.message || "Failed to import file",
            stats: { stocksProcessed: 0, transactionsAdded: 0, errors: [error.message] },
          });
        } finally {
          setIsImporting(false);
        }
      };

      reader.onerror = () => {
        toast.error("Failed to read file");
        setIsImporting(false);
      };

      reader.readAsDataURL(file);
    } catch (error: any) {
      toast.error(error.message || "Failed to import file");
      setIsImporting(false);
    }
  };

  if (!user) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Please log in to import data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import Excel Data</h1>
        <p className="text-muted-foreground mt-2">
          Upload an Excel file with your portfolio data. Each sheet should represent a stock symbol.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upload Excel File</CardTitle>
          <CardDescription>
            Select an Excel file (.xlsx or .xls) with transaction data. The "Home" sheet will be ignored.
            Each sheet should contain columns: Date, Type (Buy/Sell), Quantity, Price per Share, Total Cost.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-upload">Excel File</Label>
            <div className="flex items-center gap-4">
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={isImporting}
                className="flex-1"
              />
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{file.name}</span>
                </div>
              )}
            </div>
          </div>

          <Button
            onClick={handleImport}
            disabled={!file || isImporting}
            className="w-full"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Import Data
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              Import Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant={importResult.success ? "default" : "destructive"}>
              <AlertDescription>{importResult.message}</AlertDescription>
            </Alert>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Stocks Processed</p>
                <p className="text-2xl font-bold">{importResult.stats.stocksProcessed}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Transactions Added</p>
                <p className="text-2xl font-bold">{importResult.stats.transactionsAdded}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Errors</p>
                <p className="text-2xl font-bold text-red-600">{importResult.stats.errors.length}</p>
              </div>
            </div>

            {importResult.stats.errors.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Error Details:</p>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {importResult.stats.errors.map((error: string, index: number) => (
                    <Alert key={index} variant="destructive">
                      <AlertDescription className="text-xs">{error}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

