import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSettings } from "@/context/SettingsContext";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Folder, File, ArrowUp, Loader2, Download, Upload, MoreVertical, FolderPlus, Trash2, Pencil, KeyRound } from "lucide-react";

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
  const { settings } = useSettings();
  const [files, setFiles] = useState<SftpFile[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("/");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<SftpFile | null>(null);
  const [transferState, setTransferState] = useState<TransferState | null>(null);

  // Dialog States
  const [isMkdirOpen, setIsMkdirOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isPermOpen, setIsPermOpen] = useState(false);
  const [permValue, setPermValue] = useState("755");
  const [fileToEdit, setFileToEdit] = useState<SftpFile | null>(null);

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

  const getFullPath = (name: string) => {
    return currentPath === "/" ? `/${name}` : `${currentPath}/${name}`;
  };

  const visibleFiles = files.filter(file => {
    if (settings.sftpShowHiddenFiles) return true;
    return !file.name.startsWith('.');
  });

  // --- Actions ---

  const handleCreateDirectory = async () => {
    if (!newFolderName) return;
    const path = getFullPath(newFolderName);
    try {
        await invoke("create_directory", { sessionId, path });
        toast.success("Folder created");
        setNewFolderName("");
        setIsMkdirOpen(false);
        fetchFiles();
    } catch (e) {
        toast.error(`Failed to create folder: ${e}`);
    }
  };

  const handleDelete = async (file: SftpFile) => {
    if (!confirm(`Are you sure you want to delete ${file.name}?`)) return;
    const path = getFullPath(file.name);
    try {
        await invoke("delete_item", { sessionId, path, isDir: file.is_dir });
        toast.success("Item deleted");
        fetchFiles();
    } catch (e) {
        toast.error(`Failed to delete: ${e}`);
    }
  };

  const handleRename = async () => {
    if (!fileToEdit || !renameValue || renameValue === fileToEdit.name) return;
    const oldPath = getFullPath(fileToEdit.name);
    const newPath = getFullPath(renameValue);
    
    try {
        await invoke("rename_item", { sessionId, oldPath, newPath });
        toast.success("Renamed successfully");
        setIsRenameOpen(false);
        setFileToEdit(null);
        fetchFiles();
    } catch (e) {
        toast.error(`Rename failed: ${e}`);
    }
  };

  const handleDownload = async () => {
    if (!selectedFile || selectedFile.is_dir) {
      toast.warning("Select a file to download");
      return;
    }

    const localPath = await save({ defaultPath: selectedFile.name });
    if (!localPath) return;

    const remotePath = getFullPath(selectedFile.name);
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

    const remotePath = getFullPath(fileName);
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

  const handleChmod = async () => {
    if (!fileToEdit || !permValue) return;
    
    const mode = parseInt(permValue, 8);
    if (isNaN(mode)) {
        toast.error("Invalid permissions format. Use octal (e.g., 755)");
        return;
    }

    const path = getFullPath(fileToEdit.name);
    
    try {
        await invoke("chmod_item", { sessionId, path, mode });
        toast.success("Permissions updated");
        setIsPermOpen(false);
        setFileToEdit(null);
        fetchFiles();
    } catch (e) {
        toast.error(`Chmod failed: ${e}`);
    }
  };

  const openPermDialog = (file: SftpFile) => {
      setFileToEdit(file);
      setPermValue(file.is_dir ? "755" : "644");
      setIsPermOpen(true);
  };

  const progressValue = transferState
    ? Math.min(
        100,
        (transferState.transferredBytes / Math.max(transferState.totalBytes, 1)) * 100
      )
    : 0;

  return (
    <div className="flex flex-col h-full bg-[#21222C] text-gray-300 p-4">
      {/* Toolbar */}
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
            onClick={() => { setNewFolderName(""); setIsMkdirOpen(true); }}
            disabled={isLoading || !!transferState}
          >
            <FolderPlus className="h-4 w-4 mr-1" /> New Folder
          </Button>
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

      {/* Progress Bar */}
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

      {/* File List */}
      <div className="flex-grow overflow-hidden border border-gray-700 rounded-md">
        <div className="overflow-auto h-full">
          <Table>
            <TableHeader className="sticky top-0 bg-[#282a36]">
              <TableRow>
                <TableHead className="w-[50%]">Name</TableHead>
                <TableHead className="w-[15%]">Size</TableHead>
                <TableHead className="w-[20%]">Modified</TableHead>
                <TableHead className="w-[10%]">Perms</TableHead>
                <TableHead className="w-[5%]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Loading...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : visibleFiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    Empty directory
                  </TableCell>
                </TableRow>
              ) : (
                visibleFiles.map((file) => (
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
                    <TableCell>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                    setFileToEdit(file);
                                    setRenameValue(file.name);
                                    setIsRenameOpen(true);
                                }}>
                                    <Pencil className="mr-2 h-4 w-4" /> Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openPermDialog(file)}>
                                    <KeyRound className="mr-2 h-4 w-4" /> Permissions
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(file)} className="text-red-500 focus:text-red-500">
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Mkdir Dialog */}
      <Dialog open={isMkdirOpen} onOpenChange={setIsMkdirOpen}>
        <DialogContent className="bg-[#2b2d3b] border-gray-700 text-white">
            <DialogHeader>
                <DialogTitle>New Folder</DialogTitle>
            </DialogHeader>
            <Input 
                value={newFolderName} 
                onChange={(e) => setNewFolderName(e.target.value)} 
                placeholder="Folder Name" 
                className="bg-[#191a21] border-gray-600"
            />
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsMkdirOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateDirectory} className="bg-blue-600 hover:bg-blue-700">Create</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="bg-[#2b2d3b] border-gray-700 text-white">
            <DialogHeader>
                <DialogTitle>Rename Item</DialogTitle>
            </DialogHeader>
            <Input 
                value={renameValue} 
                onChange={(e) => setRenameValue(e.target.value)} 
                className="bg-[#191a21] border-gray-600"
            />
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsRenameOpen(false)}>Cancel</Button>
                <Button onClick={handleRename} className="bg-blue-600 hover:bg-blue-700">Rename</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={isPermOpen} onOpenChange={setIsPermOpen}>
        <DialogContent className="bg-[#2b2d3b] border-gray-700 text-white">
            <DialogHeader>
                <DialogTitle>Change Permissions</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
                <label className="text-sm text-gray-400">Octal Mode (e.g., 755, 644)</label>
                <Input 
                    value={permValue} 
                    onChange={(e) => setPermValue(e.target.value)} 
                    className="bg-[#191a21] border-gray-600"
                    maxLength={4}
                />
            </div>
            <DialogFooter>
                <Button variant="ghost" onClick={() => setIsPermOpen(false)}>Cancel</Button>
                <Button onClick={handleChmod} className="bg-blue-600 hover:bg-blue-700">Apply</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
