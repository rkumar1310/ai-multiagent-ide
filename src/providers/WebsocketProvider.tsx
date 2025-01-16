// src/providers/WebsocketProvider.tsx

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";

export const WebsocketContext = createContext<{
    websocket: WebSocket | null;
    connected: boolean;
    addMessageCallback: (callback: (event: MessageEvent) => void) => void;
    removeMessageCallback: (callback: (event: MessageEvent) => void) => void;
    startWebsocket: () => void;
    closeWebsocket: () => void;
    sendWebsocketMessage: (message: ArrayBufferLike | string) => void;
} | null>(null);

export const useWebsocketContext = () => {
    const context = useContext(WebsocketContext);
    if (!context) {
        throw new Error(
            "useWebsocketContext must be used within a WebsocketProvider"
        );
    }
    return context;
};

export function useWebsocket({ address }: { address: string }) {
    const [websocket, setWebsocket] = useState<WebSocket | null>(null);
    const [connected, setConnected] = useState<boolean>(false);

    const startWebsocket = useCallback(() => {
        const ws = new WebSocket(address);
        setWebsocket(ws);

        ws.onopen = () => {
            setConnected(true);
        };

        ws.onclose = () => {
            setConnected(false);
        };

        ws.onerror = (e) => {
            setConnected(false);
            console.error("Websocket error", e);
        };
        return () => {
            ws.close();
        };
    }, [address]);

    const closeWebsocket = useCallback(() => {
        if (websocket) {
            websocket.close();
        }
    }, [websocket]);

    const sendWebsocketMessage = useCallback(
        (message: ArrayBufferLike | string) => {
            if (websocket && websocket.readyState === WebSocket.OPEN) {
                websocket.send(message);
            }
        },
        [websocket]
    );

    return {
        websocket,
        connected,
        startWebsocket,
        closeWebsocket,
        sendWebsocketMessage,
    };
}

export default function WebsocketProvider({
    children,
    address,
}: {
    children: React.ReactNode;
    address: string;
}) {
    const [messageCallbacks, setMessageCallbacks] = useState<
        ((event: MessageEvent) => void)[]
    >([]);
    const {
        websocket,
        connected,
        startWebsocket,
        closeWebsocket,
        sendWebsocketMessage,
    } = useWebsocket({
        address,
    });

    useEffect(() => {
        if (websocket) {
            websocket.onmessage = (event) => {
                messageCallbacks.forEach((callback) => {
                    callback(event);
                });
            };
        }
    }, [messageCallbacks, websocket]);

    const addMessageCallback = useCallback(
        (callback: (event: MessageEvent) => void) => {
            setMessageCallbacks((prev) => [...prev, callback]);
        },
        [setMessageCallbacks]
    );

    const removeMessageCallback = useCallback(
        (callback: (event: MessageEvent) => void) => {
            setMessageCallbacks((prev) => {
                return prev.filter((cb) => cb !== callback);
            });
        },
        [setMessageCallbacks]
    );

    const receiveMessage = useCallback(() => {
        // TODO: optimize this
        // if (typeof event.data === "string") {
        //     const data = JSON.parse(event.data);
        //     if (data.type === "mic") {
        //         setApplicationState((prev) => ({
        //             ...prev,
        //             micState: data.state,
        //         }));
        //     }
        // }
    }, []);

    useEffect(() => {
        addMessageCallback(receiveMessage);
        return () => {
            removeMessageCallback(receiveMessage);
        };
    }, [addMessageCallback, receiveMessage, removeMessageCallback]);

    useEffect(() => {
        return startWebsocket();
    }, [startWebsocket]);

    return (
        <WebsocketContext.Provider
            value={{
                websocket,
                connected,
                addMessageCallback,
                removeMessageCallback,
                startWebsocket,
                closeWebsocket,
                sendWebsocketMessage,
            }}
        >
            {children}
        </WebsocketContext.Provider>
    );
}
