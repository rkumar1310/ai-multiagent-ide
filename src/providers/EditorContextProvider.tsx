import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { useWebsocketContext } from "./WebsocketProvider";
export interface TreeData {
    label: string;
    value: string;
    children?: TreeData[];
}
export const EditorContext = createContext<{
    selectedFile: string;
    selectedFileContent: string;
    setSelectedFile: (file: string) => void;
    treeData: TreeData[];
} | null>(null);

export const useEditorContext = () => {
    const context = useContext(EditorContext);
    if (!context) {
        throw new Error(
            "useEditorContext must be used within a EditorContextProvider"
        );
    }
    return context;
};

export function EditorContextProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const [selectedFile, setSelectedFile] = useState<string>("");
    const selectedFileRef = useRef(selectedFile); // using a ref here to avoid race condition from websocket callback
    const [selectedFileContent, setSelectedFileContent] = useState<string>("");
    const [treeData, setTreeData] = useState<TreeData[]>([]);
    const { addMessageCallback, sendWebsocketMessage, removeMessageCallback } =
        useWebsocketContext();

    const processWebsocketMessage = useCallback((event: MessageEvent) => {
        if (typeof event.data === "string") {
            const message = JSON.parse(event.data);
            if (message.type === "fileContent") {
                setSelectedFileContent(message.data);
                setSelectedFile(message.file);
            }
            if (message.type === "directory-tree") {
                setTreeData(message.data);
            }
        }
    }, []);

    useEffect(() => {
        addMessageCallback(processWebsocketMessage);
        if (selectedFile.endsWith("/")) {
            return;
        }
        sendWebsocketMessage(
            JSON.stringify({
                type: "getFile",
                data: selectedFile,
            })
        );
        return () => {
            removeMessageCallback(processWebsocketMessage);
        };
    }, [
        addMessageCallback,
        processWebsocketMessage,
        removeMessageCallback,
        selectedFile,
        sendWebsocketMessage,
    ]);

    useEffect(() => {
        selectedFileRef.current = selectedFile;
    }, [selectedFile]);

    return (
        <EditorContext.Provider
            value={{
                selectedFile,
                setSelectedFile,
                selectedFileContent,
                treeData,
            }}
        >
            {children}
        </EditorContext.Provider>
    );
}
