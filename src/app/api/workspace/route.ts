import { NextResponse } from "next/server";

export async function GET() {
    const stream = new ReadableStream({
        // start(controller) {
        //     // const observer = new DirectoryObserver(controller);
        //     // observer.start();
        // },
    });

    return new NextResponse(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}
