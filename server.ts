import { WebSocketServer, WebSocket } from "ws";
import { readFileSync } from "fs";
import directoryTree, {
    DirectoryTree,
    DirectoryTreeCallback,
} from "directory-tree";
import chokidar from "chokidar";
import { ChildProcess, spawn } from "child_process";
import { createInterface } from "readline";
import path from "path";
import stripAnsi from "strip-ansi";

const wss = new WebSocketServer({ port: 3002 });

function sortTree(tree: DirectoryTree): ExtendedDirectoryTree {
    if (tree.children) {
        tree.children.sort((a, b) => {
            // Directories come first, then files
            if (a.type === "directory" && b.type !== "directory") return -1;
            if (a.type !== "directory" && b.type === "directory") return 1;

            // If same type, sort alphabetically by name
            return a.name.localeCompare(b.name);
        });

        // Recursively sort children
        tree.children.forEach(sortTree);
    }
    return tree as ExtendedDirectoryTree;
}
interface ExtendedDirectoryTree extends DirectoryTree {
    label: string;
    value: string;
}
class DirectoryObserver {
    count: number = 0;
    // Initialize watcher.
    watcher = chokidar.watch("./code-server/workspace", {
        persistent: true,
        ignored: /node_modules|\.next|\.git/,
        ignoreInitial: true,
    });

    websocket: WebSocket;
    constructor(websocket: WebSocket) {
        // Something to use when events are received.
        this.websocket = websocket;
        // Add event listeners.
        this.watcher
            .on("add", () => this.SendDirectoryTree())
            .on("change", (path) => {
                // send the new file content
                const fileContent =
                    readFileSync("./" + path, "utf-8") || "File not found";
                websocket.send(
                    JSON.stringify({
                        type: "fileContent",
                        data: fileContent,
                        file: path,
                    })
                );
            })
            .on("unlink", () => this.SendDirectoryTree());

        this.SendDirectoryTree();
    }
    public SendDirectoryTree() {
        const callback: DirectoryTreeCallback = (item: DirectoryTree) => {
            (item as ExtendedDirectoryTree).label = item.name;
            (item as ExtendedDirectoryTree).value = item.path;
        };
        let tree = directoryTree(
            "./code-server/workspace",
            {
                exclude: /node_modules|\.next|\.git/,
                attributes: ["type", "size", "extension"],
            },
            callback,
            callback
        ) as DirectoryTree & {
            label: string;
            value: string;
        };

        tree = sortTree(tree);

        // return JSON.stringify(tree.children);
        this.websocket.send(
            JSON.stringify({
                type: "directory-tree",
                data: tree.children,
            })
        );
    }

    public stop() {
        this.watcher.close();
    }
}
class NextJSRunner {
    websocket: WebSocket;
    errorBuffer: string[];
    interval: NodeJS.Timeout | null;
    process: ChildProcess | null;
    constructor(websocket: WebSocket) {
        this.websocket = websocket;
        this.errorBuffer = [];
        this.interval = null;
        this.process = null;
        this.start();
    }

    captureErrors(timeWindow: number) {
        if (!this.process || !this.process.stderr) {
            return;
        }
        const rl = createInterface({ input: this.process.stderr });

        rl.on("line", (line) => {
            console.log(`-----> ${line.trim()}`);
            this.errorBuffer.push(stripAnsi(line.trim()));
        });

        this.interval = setInterval(() => {
            if (this.errorBuffer.length > 0) {
                const errors = this.errorBuffer.join("\n");
                this.websocket.send(
                    JSON.stringify({
                        type: "error",
                        data: errors,
                    })
                );
                console.log("Errors captured in the last time window:");
                console.log(errors);
                console.log("=".repeat(40));
                this.errorBuffer = [];
            }
        }, timeWindow * 1000);

        this.process.on("close", () => {
            if (this.interval) clearInterval(this.interval);
            rl.close();
        });
    }

    start(command = "npm", args = ["run", "dev"], timeWindow = 5) {
        console.log("Starting NextJS server...");
        this.process = spawn(command, args, {
            stdio: ["ignore", "pipe", "pipe"],
            cwd: path.resolve(__dirname, "code-server/workspace"),
        });

        this.captureErrors(timeWindow);

        this.process.on("close", (code) => {
            console.log(`Process exited with code ${code}`);
            this.websocket.send(`Process exited with code ${code}`);
        });

        this.process.on("error", (err) => {
            console.error("Failed to start process:", err);
            this.websocket.send(`Failed to start process: ${err.message}`);
        });
    }

    stop() {
        if (this.process) {
            this.process.kill();
            this.process = null;
        }
    }
}

wss.on("connection", function connection(ws) {
    const directoryObserver = new DirectoryObserver(ws);
    const nextJSRunner = new NextJSRunner(ws);
    ws.on("message", function message(data) {
        // get JSON from data
        const message = JSON.parse(data.toString());

        if (message.type === "getFile") {
            try {
                const file = message.data;

                const fileContent = readFileSync("./" + file, "utf-8");

                ws.send(
                    JSON.stringify({
                        type: "fileContent",
                        data: fileContent,
                        file,
                    })
                );
            } catch {
                ws.send(
                    JSON.stringify({
                        type: "fileContent",
                        data: "File not found",
                    })
                );
            }
        }
    });

    ws.on("close", function close() {
        console.log("disconnected");
        directoryObserver.stop();
        nextJSRunner.stop();
    });
});
