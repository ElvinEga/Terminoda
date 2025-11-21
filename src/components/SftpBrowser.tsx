import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Folder, File, ArrowUp, Loader2, Download, Upload } from "lucide-react";

interface SftpFile {
  name: string;
  is_dir: boolean;
  size: number;
  permissions: string;
  modified: number;
}

interface SftpBrowserProps {
  sessionId: string;
}

interface TransferState {
  filePath: string;
  transferredBytes: number;
  totalBytes: number;
  type: "upload" | "download";
}

interface TransferProgressPayload {
  session_id: string;
  file_path: string;
  transferred_bytes: number;
  total_bytes: number;
}

export function SftpBrowser({ sessionId }: SftpBrowserProps) {
  const [files, setFiles] = useState<SftpFile[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SftpFile | null>(null);
  const [transferState, setTransferState] = useState<TransferState | null>(null);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const result = await invoke<SftpFile[]>("list_directory", { sessionId, path: currentPath });
      setFiles(result);
    } catch (error) {
      const errorMsg = typeof error === "string" ? error : String(error);
      toast.error(`Failed to list directory: ${errorMsg}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [sessionId, currentPath]);

  useEffect(() => {
    const unlistenPromise = listen<TransferProgressPayload>("transfer-progress", (event) => {
      if (event.payload.session_id !== sessionId) return;
      setTransferState((prev) => {
        if (!prev) return prev;
        const isSameFile = prev.filePath === event.payload.file_path || prev.filePath.endsWith(event.payload.file_path);
        if (!isSameFile) return prev;
        return {
          ...prev,
          transferredBytes: event.payload.transferred_bytes,
          totalBytes: event.payload.total_bytes || prev.totalBytes,
        };
      });
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [sessionId]);

  const handleNavigate = (fileName: string) => {
    const newPath = currentPath === "/" ? `/${fileName}` : `${currentPath}/${fileName}`;
    setCurrentPath(newPath);
  };

  const handleGoUp = () => {
    if (currentPath === "/") return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length > 0 ? "/" + parts.join("/") : "/");
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  const handleDownload = async () => {
    if (!selectedFile || selectedFile.is_dir) {
      toast.warning("Select a file to download");
      return;
    }

    const localPath = await save({ defaultPath: selectedFile.name });
    if (!localPath) return;

    const remotePath = currentPath === "/" ? `/${selectedFile.name}` : `${currentPath}/${selectedFile.name}`;
    setTransferState({
      filePath: remotePath,
      transferredBytes: 0,
      totalBytes: selectedFile.size,
      type: "download",
    });

    toast.promise(
      invoke("download_file", {
        sessionId,
        remotePath,
        localPath,
      }),
      {
        loading: `Downloading ${selectedFile.name}...`,
        success: () => {
          setTransferState(null);
          return `${selectedFile.name} downloaded`;
        },
        error: (err) => {
          setTransferState(null);
          return typeof err === "string" ? err : "Download failed";
        },
      }
    );
  };

  const handleUpload = async () => {
    const localPath = await open({ multiple: false });
    if (!localPath || Array.isArray(localPath)) return;

    const fileName = localPath.split(/[/\\]/).pop();
    if (!fileName) {
      toast.error("Unable to detect filename");
      return;
    }

    const remotePath = currentPath === "/" ? `/${fileName}` : `${currentPath}/${fileName}`;
    setTransferState({
      filePath: localPath,
      transferredBytes: 0,
      totalBytes: 0,
      type: "upload",
    });

    toast.promise(
      invoke("upload_file", {
        sessionId,
        localPath,
        remotePath,
      }),
      {
        loading: `Uploading ${fileName}...`,
        success: () => {
          setTransferState(null);
          fetchFiles();
          return `${fileName} uploaded`;
        },
        error: (err) => {
          setTransferState(null);
          return typeof err === "string" ? err : "Upload failed";
        },
      }
    );
  };

  const progressValue = transferState
    ? Math.min(
        100,
        (transferState.transferredBytes / Math.max(transferState.totalBytes, 1)) * 100
      )
    : 0;

  return (
    <div className="flex flex-col h-full bg-[#21222C] text-gray-300 p-4">
      <div className="flex items-center gap-3 mb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleGoUp}
          disabled={currentPath === "/" || isLoading || !!transferState}
          className="flex-shrink-0"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <code className="flex-grow px-3 py-2 bg-[#282a36] rounded border border-gray-700 text-sm overflow-x-auto">
          {currentPath}
        </code>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUpload}
            disabled={isLoading || !!transferState}
          >
            <Upload className="h-4 w-4 mr-1" /> Upload
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={
              isLoading ||
              !!transferState ||
              !selectedFile ||
              selectedFile.is_dir
            }
          >
            <Download className="h-4 w-4 mr-1" /> Download
          </Button>
        </div>
      </div>

      {transferState && (
        <div className="mb-3">
          <p className="text-xs text-gray-400 mb-1">
            {transferState.type === "download" ? "Downloading" : "Uploading"}:
            <span className="font-mono ml-1">
              {transferState.filePath.split(/[/\\]/).pop() || transferState.filePath}
            </span>
          </p>
          <Progress value={progressValue} className="h-2" />
        </div>
      )}

      <div className="flex-grow overflow-hidden border border-gray-700 rounded-md">
        <div className="overflow-auto h-full">
          <Table>
            <TableHeader className="sticky top-0 bg-[#282a36]">
              <TableRow>
                <TableHead className="w-6/12">Name</TableHead>
                <TableHead className="w-2/12">Size</TableHead>
                <TableHead className="w-2/12">Modified</TableHead>
                <TableHead className="w-2/12">Permissions</TableHead>
              TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : files.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                    Empty directory
                  </TableCell>
                </TableRow>
              ) : (
                files.map((file) => (
                  <TableRow
                    key={file.name}
                    onDoubleClick={file.is_dir ? () => handleNavigate(file.name) : undefined}
                    onClick={() => setSelectedFile(file)}
                    className={cn(
                      file.is_dir ? "cursor-pointer hover:bg-gray-700" : "hover:bg-gray-700",
                      selectedFile?.name === file.name && "bg-blue-900/40"
                    )}
                  >
                    <TableCell className="flex items-center gap-2 py-2">
                      {file.is_dir ? (
                        <Folder className="h-4 w-4 text-blue-400 flex-shrink-0" />
                      ) : (
                        <File className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      )}
                      <span className="truncate">{file.name}</span>
                    </TableCell>
                    <TableCell className="text-sm">{file.is_dir ? "-" : formatBytes(file.size)}</TableCell>
                    <TableCell className="text-sm text-gray-400">{formatDate(file.modified)}</TableCell>
                    <TableCell className="font-mono text-xs">{file.permissions}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
