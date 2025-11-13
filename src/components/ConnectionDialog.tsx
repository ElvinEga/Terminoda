import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { invoke } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"
import { useState } from "react"
import { FolderOpen, PlusCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { SavedHost } from "./VaultSidebar"

const formSchema = z.object({
  name: z.string().min(1, "Host name is required"),
  host: z.string().min(1, "Host is required"),
  port: z.coerce.number().int().min(1).max(65535).default(22),
  username: z.string().min(1, "Username is required"),
  authMethod: z.enum(["password", "key"]).default("password"),
  password: z.string().optional(),
  private_key_path: z.string().optional(),
  passphrase: z.string().optional(),
}).refine((data) => {
  if (data.authMethod === "password" && !data.password) return false;
  if (data.authMethod === "key" && !data.private_key_path) return false;
  return true;
}, {
  message: "Password or Private Key is required",
  path: ["password"],
});

type FormValues = z.infer<typeof formSchema>;

interface ConnectionDialogProps {
  onSave: (newHost: SavedHost) => void;
}

export function ConnectionDialog({ onSave }: ConnectionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      host: "",
      port: 22,
      username: "",
      authMethod: "password",
      password: "",
      private_key_path: "",
      passphrase: "",
    },
  })

  const handleFileSelect = async () => {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'SSH Keys', extensions: ['pem', 'key', 'pub', ''] }],
    });
    if (selected && typeof selected === 'string') {
      form.setValue("private_key_path", selected);
    }
  };

  async function onSubmit(values: FormValues) {
    setSaveError(null);
    try {
      const { name, ...details } = values;
      const newSavedHost = await invoke<SavedHost>('save_new_host', { name, details });
      onSave(newSavedHost);
      setIsOpen(false);
      form.reset();
    } catch (error) {
      const errorMsg = typeof error === 'string' ? error : String(error);
      console.error("Failed to save host:", errorMsg);
      setSaveError(errorMsg);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          <PlusCircle className="mr-2 h-4 w-4" /> New Host
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Save New SSH Host</DialogTitle>
          <DialogDescription>
            Enter host details and choose authentication method.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Host Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Server" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="host"
                render={({ field }) => (
                  <FormItem className="flex-grow">
                    <FormLabel>Host</FormLabel>
                    <FormControl>
                      <Input placeholder="192.168.1.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="port"
                render={({ field }) => (
                  <FormItem className="w-24">
                    <FormLabel>Port</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="22" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="root" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Tabs defaultValue="password" onValueChange={(v) => form.setValue("authMethod", v as "password" | "key")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="password">Password</TabsTrigger>
                <TabsTrigger value="key">Private Key</TabsTrigger>
              </TabsList>
              
              <TabsContent value="password" className="space-y-3">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
              
              <TabsContent value="key" className="space-y-3">
                <div className="flex gap-2 items-end">
                  <FormField
                    control={form.control}
                    name="private_key_path"
                    render={({ field }) => (
                      <FormItem className="flex-grow">
                        <FormLabel>Key Path</FormLabel>
                        <FormControl>
                          <Input placeholder="/home/user/.ssh/id_rsa" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="button" variant="outline" onClick={handleFileSelect}>
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </div>
                <FormField
                  control={form.control}
                  name="passphrase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Passphrase (Optional)</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Key passphrase" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            {saveError && (
              <p className="text-sm font-medium text-red-500">
                {saveError}
              </p>
            )}
            
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Saving..." : "Save Connection"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
