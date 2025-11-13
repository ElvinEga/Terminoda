import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Folder, File, ArrowUp, Loader2 } from "lucide-react";

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

export function SftpBrowser({ sessionId }: SftpBrowserProps) {
  const [files, setFiles] = useState<SftpFile[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("/root");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchFiles = async () => {
      setIsLoading(true);
      try {
        const result = await invoke<SftpFile[]>("list_directory", { sessionId, path: currentPath });
        setFiles(result);
      } catch (error) {
        const errorMsg = typeof error === 'string' ? error : String(error);
        toast.error(`Failed to list directory: ${errorMsg}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFiles();
  }, [sessionId, currentPath]);

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

  return (
    <div className="flex flex-col h-full bg-[#21222C] text-gray-300 p-4">
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleGoUp}
          disabled={currentPath === "/" || isLoading}
          className="flex-shrink-0"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <code className="flex-grow px-3 py-2 bg-[#282a36] rounded border border-gray-700 text-sm overflow-x-auto">
          {currentPath}
        </code>
      </div>

      <div className="flex-grow overflow-hidden border border-gray-700 rounded-md">
        <div className="overflow-auto h-full">
          <Table>
            <TableHeader className="sticky top-0 bg-[#282a36]">
              <TableRow>
                <TableHead className="w-6/12">Name</TableHead>
                <TableHead className="w-2/12">Size</TableHead>
                <TableHead className="w-2/12">Modified</TableHead>
                <TableHead className="w-2/12">Permissions</TableHead>
              </TableRow>
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
                    className={file.is_dir ? "cursor-pointer hover:bg-gray-700" : ""}
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
