// Application wiring: Web Serial link, front-panel controls and status polling.

import {
    KEYS,
    buildCatFrequencyPacket,
    buildKeyPacket,
    buildRcuPacket,
    buildStatusRequestPacket,
    decodeStatus,
    describeResponse
} from "./protocol.js";
import { AmplifierLink, isSupported } from "./serial.js";
import {
    appendLog,
    clearLog,
    renderStatus,
    resetStatus,
    setLinkState,
    showError
} from "./ui.js";

const link = new AmplifierLink();
let pollTimer = null;
let pollInFlight = false;
let lastStatus = null;
let readingSettings = false;
const statusWaiters = new Set();

const ui = {
    connect: document.getElementById("btn-connect"),
    disconnect: document.getElementById("btn-disconnect"),
    baud: document.getElementById("sel-baud"),
    unsupported: document.getElementById("unsupported"),
    autoRead: document.getElementById("chk-auto-read"),
    readSettings: document.getElementById("btn-read-settings"),
    readNote: document.getElementById("read-note"),
    rcu: document.getElementById("chk-rcu"),
    pollRate: document.getElementById("poll-rate"),
    pollOnce: document.getElementById("btn-poll-once"),
    powerOn: document.getElementById("btn-power-on"),
    powerOff: document.getElementById("btn-power-off"),
    catFreq: document.getElementById("cat-freq"),
    catSend: document.getElementById("btn-cat-send"),
    logStatus: document.getElementById("chk-log-status"),
    logClear: document.getElementById("btn-log-clear"),
    tabList: document.querySelector(".tabs")
};

const liveControls = [
    ui.readSettings, ui.rcu, ui.pollRate, ui.pollOnce, ui.powerOn, ui.powerOff,
    ui.catFreq, ui.catSend
];

function setControlsEnabled(enabled) {
    for (const control of liveControls) {
        control.disabled = !enabled;
    }
    for (const button of document.querySelectorAll("button[data-key]")) {
        button.disabled = !enabled;
    }
    ui.connect.disabled = enabled;
    ui.disconnect.disabled = !enabled;
    ui.baud.disabled = enabled;
}

async function send(packet) {
    try {
        await link.send(packet);
        showError("");
    } catch (error) {
        showError(`Send failed: ${error.message}`);
    }
}

function stopPolling() {
    if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

function restartPolling() {
    stopPolling();
    const rate = Number(ui.pollRate.value);
    if (!link.isConnected || ui.rcu.checked || rate <= 0) {
        return;
    }
    pollTimer = setInterval(async () => {
        if (pollInFlight) {
            return;
        }
        pollInFlight = true;
        try {
            await link.send(buildStatusRequestPacket());
        } catch (error) {
            showError(`Polling stopped: ${error.message}`);
            stopPolling();
        } finally {
            pollInFlight = false;
        }
    }, Math.round(1000 / rate));
}

function resolveStatusWaiters(status) {
    for (const waiter of [...statusWaiters]) {
        if (waiter.predicate(status)) {
            statusWaiters.delete(waiter);
            waiter.resolve(status);
        }
    }
}

function cancelStatusWaiters(reason) {
    for (const waiter of [...statusWaiters]) {
        statusWaiters.delete(waiter);
        waiter.reject(new Error(reason));
    }
}

function waitForStatus(predicate, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            statusWaiters.delete(waiter);
            reject(new Error("no matching status packet"));
        }, timeoutMs);
        const waiter = {
            predicate,
            resolve: (status) => {
                clearTimeout(timer);
                resolve(status);
            },
            reject: (error) => {
                clearTimeout(timer);
                reject(error);
            }
        };
        statusWaiters.add(waiter);
    });
}

const CAT_INFO_CTX = 0x03;

/**
 * Setup values only reach the host while the matching screen is on the LCD, so the
 * CAT info screen is opened briefly and then left with the DISPLAY key.
 */
async function readSettings() {
    if (!link.isConnected || readingSettings) {
        return;
    }
    readingSettings = true;
    ui.readSettings.disabled = true;
    ui.readNote.textContent = "Reading settings\u2026";

    const needsNudge = !ui.rcu.checked && Number(ui.pollRate.value) <= 0;
    const nudge = needsNudge
        ? setInterval(() => {
            link.send(buildStatusRequestPacket()).catch(() => undefined);
        }, 200)
        : null;

    try {
        const first = lastStatus ?? await waitForStatus(() => true, 4000);
        if (first.flags.transmitting) {
            ui.readNote.textContent = "Waiting for transmission to end\u2026";
            try {
                await waitForStatus((status) => !status.flags.transmitting, 15000);
            } catch {
                ui.readNote.textContent = "Skipped: amplifier is transmitting.";
                return;
            }
        }
        await link.send(buildKeyPacket(KEYS.CAT));
        await waitForStatus((status) => status.displayCtx === CAT_INFO_CTX, 3000);
        await link.send(buildKeyPacket(KEYS.DISPLAY));
        await waitForStatus((status) => status.displayCtx !== CAT_INFO_CTX, 3000)
            .catch(() => undefined);
        const time = new Date().toLocaleTimeString([], { hour12: false });
        ui.readNote.textContent = `CAT settings read at ${time}.`;
    } catch (error) {
        ui.readNote.textContent = `Settings read failed: ${error.message}`;
    } finally {
        if (nudge !== null) {
            clearInterval(nudge);
        }
        readingSettings = false;
        ui.readSettings.disabled = !link.isConnected;
    }
}

link.addEventListener("open", (event) => {
    setLinkState(`Connected ${event.detail.baudRate} bps`, true);
    setControlsEnabled(true);
    restartPolling();
    if (ui.autoRead.checked) {
        void readSettings();
    }
});

link.addEventListener("close", () => {
    stopPolling();
    cancelStatusWaiters("Disconnected");
    lastStatus = null;
    setLinkState("Disconnected", false);
    setControlsEnabled(false);
    resetStatus();
    ui.readNote.textContent = "";
});

link.addEventListener("error", (event) => {
    showError(event.detail.error?.message ?? String(event.detail.error));
});

link.addEventListener("tx", (event) => {
    appendLog("tx", event.detail.bytes);
});

link.addEventListener("packet", (event) => {
    const { data, raw, kind } = event.detail;
    if (kind === "status") {
        const status = decodeStatus(data);
        lastStatus = status;
        resolveStatusWaiters(status);
        renderStatus(status);
        if (ui.logStatus.checked) {
            appendLog("rx", raw, "STATUS");
        }
        return;
    }
    appendLog("rx", raw, describeResponse(data));
});

ui.connect.addEventListener("click", async () => {
    try {
        showError("");
        await link.connect({ baudRate: Number(ui.baud.value) });
    } catch (error) {
        if (error.name !== "NotFoundError") {
            showError(`Connection failed: ${error.message}`);
        }
    }
});

ui.disconnect.addEventListener("click", async () => {
    await link.disconnect();
});

ui.readSettings.addEventListener("click", () => {
    void readSettings();
});

document.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-key]");
    if (!button || button.disabled) {
        return;
    }
    const code = KEYS[button.dataset.key];
    if (code === undefined) {
        return;
    }
    void send(buildKeyPacket(code));
});

const tabs = Array.from(ui.tabList.querySelectorAll("[role=\"tab\"]"));

function selectTab(tab) {
    for (const candidate of tabs) {
        const selected = candidate === tab;
        candidate.setAttribute("aria-selected", String(selected));
        candidate.tabIndex = selected ? 0 : -1;
        document.getElementById(candidate.getAttribute("aria-controls")).hidden = !selected;
    }
}

ui.tabList.addEventListener("click", (event) => {
    const tab = event.target.closest("[role=\"tab\"]");
    if (tab) {
        selectTab(tab);
    }
});

ui.tabList.addEventListener("keydown", (event) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) {
        return;
    }
    event.preventDefault();
    const current = tabs.findIndex((tab) => tab.getAttribute("aria-selected") === "true");
    const next = tabs[(current + step + tabs.length) % tabs.length];
    selectTab(next);
    next.focus();
});

ui.rcu.addEventListener("change", async () => {
    await send(buildRcuPacket(ui.rcu.checked));
    restartPolling();
});

ui.pollRate.addEventListener("change", restartPolling);

ui.pollOnce.addEventListener("click", () => {
    void send(buildStatusRequestPacket());
});

ui.powerOn.addEventListener("click", async () => {
    try {
        await link.setPower(true);
        showError("");
    } catch (error) {
        showError(`DTR control failed: ${error.message}`);
    }
});

ui.powerOff.addEventListener("click", async () => {
    try {
        await link.setPower(false);
        showError("");
    } catch (error) {
        showError(`DTR control failed: ${error.message}`);
    }
});

ui.catSend.addEventListener("click", () => {
    const khz = Number(ui.catFreq.value);
    if (!Number.isFinite(khz) || khz < 0 || khz > 55000) {
        showError("Enter a frequency between 0 and 55000 kHz.");
        return;
    }
    void send(buildCatFrequencyPacket(khz));
});

ui.logClear.addEventListener("click", clearLog);

window.addEventListener("beforeunload", () => {
    stopPolling();
});

if (!isSupported()) {
    ui.unsupported.hidden = false;
}
setControlsEnabled(false);
ui.connect.disabled = !isSupported();
ui.baud.disabled = !isSupported();
resetStatus();

