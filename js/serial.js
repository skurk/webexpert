// Web Serial transport for the EXPERT amplifier link.

import { DEFAULT_BAUD_RATE, PacketParser, SERIAL_OPTIONS } from "./protocol.js";

export function isSupported() {
    return typeof navigator !== "undefined" && "serial" in navigator;
}

export class AmplifierLink extends EventTarget {
    #port = null;
    #reader = null;
    #writer = null;
    #parser = new PacketParser();
    #readLoop = null;
    #closing = false;

    get isConnected() {
        return this.#port !== null && this.#writer !== null;
    }

    #emit(type, detail) {
        this.dispatchEvent(new CustomEvent(type, { detail }));
    }

    async connect({ requestNewPort = true, baudRate = DEFAULT_BAUD_RATE } = {}) {
        if (!isSupported()) {
            throw new Error("Web Serial is not available in this browser.");
        }
        if (this.isConnected) {
            return;
        }

        let port = null;
        if (!requestNewPort) {
            const granted = await navigator.serial.getPorts();
            port = granted[0] ?? null;
        }
        if (!port) {
            port = await navigator.serial.requestPort();
        }

        await port.open({ ...SERIAL_OPTIONS, baudRate });
        this.#port = port;
        this.#closing = false;
        this.#parser.reset();
        this.#writer = port.writable.getWriter();
        this.#readLoop = this.#read();
        this.#emit("open", { info: port.getInfo?.() ?? {}, baudRate });
    }

    async #read() {
        while (this.#port?.readable && !this.#closing) {
            this.#reader = this.#port.readable.getReader();
            try {
                for (;;) {
                    const { value, done } = await this.#reader.read();
                    if (done) {
                        break;
                    }
                    if (!value?.length) {
                        continue;
                    }
                    this.#emit("rx", { bytes: value });
                    for (const packet of this.#parser.push(value)) {
                        this.#emit("packet", packet);
                    }
                }
            } catch (error) {
                if (!this.#closing) {
                    this.#emit("error", { error });
                }
            } finally {
                try {
                    this.#reader.releaseLock();
                } catch {
                    // Lock already released during teardown.
                }
                this.#reader = null;
            }
        }
    }

    async send(packet) {
        if (!this.#writer) {
            throw new Error("Not connected.");
        }
        await this.#writer.write(packet);
        this.#emit("tx", { bytes: packet });
    }

    /** DTR high powers the amplifier on; DTR low powers it off. */
    async setPower(on) {
        if (!this.#port) {
            throw new Error("Not connected.");
        }
        await this.#port.setSignals({ dataTerminalReady: Boolean(on) });
        this.#emit("power", { on: Boolean(on) });
    }

    async disconnect() {
        if (!this.#port) {
            return;
        }
        this.#closing = true;
        try {
            await this.#reader?.cancel();
        } catch {
            // Reader may already be closed.
        }
        try {
            await this.#readLoop;
        } catch {
            // Read loop errors are reported while running.
        }
        try {
            this.#writer?.releaseLock();
        } catch {
            // Writer lock may already be released.
        }
        this.#writer = null;
        try {
            await this.#port.close();
        } catch (error) {
            this.#emit("error", { error });
        }
        this.#port = null;
        this.#parser.reset();
        this.#emit("close", {});
    }
}
