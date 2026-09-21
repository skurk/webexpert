// DOM rendering for the amplifier status packets.

import { toHex } from "./protocol.js";

const el = (id) => document.getElementById(id);

const refs = {
    linkState: el("link-state"),
    errorBanner: el("error-banner"),
    barOperate: el("bar-operate"),
    barTx: el("bar-tx"),
    barAlarm: el("bar-alarm"),
    operate: el("st-operate"),
    tx: el("st-tx"),
    tune: el("st-tune"),
    alarm: el("st-alarm"),
    mode: el("st-mode"),
    contest: el("st-contest"),
    beep: el("st-beep"),
    display: el("st-display"),
    input: el("st-input"),
    band: el("st-band"),
    freq: el("st-freq"),
    antenna: el("st-antenna"),
    cat: el("st-cat"),
    startup: el("st-startup"),
    firmware: el("st-firmware"),
    paValue: el("m-pa-value"),
    paBar: el("m-pa-bar"),
    paScale: el("m-pa-scale"),
    prValue: el("m-pr-value"),
    prBar: el("m-pr-bar"),
    swrLabel: el("m-swr-label"),
    swrValue: el("m-swr-value"),
    swrBar: el("m-swr-bar"),
    swrScale: el("m-swr-scale"),
    vaValue: el("m-va-value"),
    vaBar: el("m-va-bar"),
    iaValue: el("m-ia-value"),
    iaBar: el("m-ia-bar"),
    tempValue: el("m-temp-value"),
    tempBar: el("m-temp-bar"),
    tempScale: el("m-temp-scale"),
    alarmList: el("alarm-list"),
    setupView: el("setup-view"),
    setupStored: el("setup-stored"),
    log: el("log")
};

// Setup values are only present while the matching screen is on the amplifier LCD,
// so the last decoded copy is kept for the stored-settings section.
let captured = { catInfo: null, antennaMenu: null };

const MAX_LOG_LINES = 300;

function setPill(node, on, onText, offText = onText) {
    node.textContent = on ? onText : offText;
    node.classList.toggle("pill-on", on);
    node.classList.toggle("pill-off", !on);
}

function setMeter(bar, value, max) {
    const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
    bar.style.width = `${(ratio * 100).toFixed(1)}%`;
}

function formatFrequency(khz) {
    if (!khz) {
        return "\u2014";
    }
    return `${(khz / 1000).toFixed(3)} MHz`;
}

export function setLinkState(text, connected) {
    setPill(refs.linkState, connected, text, text);
}

export function showError(message) {
    if (!message) {
        refs.errorBanner.hidden = true;
        refs.errorBanner.textContent = "";
        return;
    }
    refs.errorBanner.hidden = false;
    refs.errorBanner.textContent = message;
}

export function renderStatus(status) {
    const { flags } = status;

    setPill(refs.operate, flags.operate, "OPERATE", "STANDBY");
    setPill(refs.tx, flags.transmitting, "TX", "RX");
    setPill(refs.tune, flags.tuning, "TUNING", "TUNE");
    setPill(refs.alarm, flags.alarm, "ALARM", "ALARM");
    setPill(refs.mode, flags.fullPower, "FULL", "HALF");
    setPill(refs.contest, flags.contest, "CONTEST", "CONTEST");
    setPill(refs.beep, flags.beep, "BEEP", "BEEP");
    refs.tx.classList.toggle("pill-tx", flags.transmitting);
    refs.alarm.classList.toggle("pill-alarm", flags.alarm);

    setPill(refs.barOperate, flags.operate, "OPERATE", "STANDBY");
    setPill(refs.barTx, flags.transmitting, "TX", "RX");
    setPill(refs.barAlarm, flags.alarm, "ALARM", "ALARM");
    refs.barTx.classList.toggle("pill-tx", flags.transmitting);
    refs.barAlarm.classList.toggle("pill-alarm", flags.alarm);

    refs.display.textContent = `${status.displayContext.text} (0x${status.displayCtx.toString(16).padStart(2, "0")})`;
    refs.input.textContent = `IN ${status.input}`;
    refs.band.textContent = `${status.band} / ${status.subBand}`;
    refs.freq.textContent = formatFrequency(status.frequencyKhz);
    refs.antenna.textContent = status.antenna;
    refs.cat.textContent = status.cat;
    refs.startup.textContent = status.startupMode;
    if (status.catInfo) {
        refs.firmware.textContent = status.catInfo.firmwareRelease;
    }

    const paMax = !flags.operate ? 200 : (flags.fullPower ? 1200 : 600);
    refs.paScale.textContent = `0 \u2013 ${paMax} Wpep`;
    refs.paValue.textContent = `${status.powerOutWpep.toFixed(1)} W`;
    setMeter(refs.paBar, status.powerOutWpep, paMax);

    refs.prValue.textContent = `${status.reversePowerWpep.toFixed(1)} W`;
    setMeter(refs.prBar, status.reversePowerWpep, 200);

    if (flags.operate) {
        refs.swrLabel.textContent = "PA gain";
        refs.swrScale.textContent = "10.0 \u2013 20.0 dB";
        const gain = status.gainDb;
        refs.swrValue.textContent = gain <= 9.9 ? "< 10.0 dB"
            : gain >= 20.1 ? "> 20.0 dB"
                : `${gain.toFixed(1)} dB`;
        setMeter(refs.swrBar, Math.min(Math.max(gain, 10) - 10, 10), 10);
    } else {
        refs.swrLabel.textContent = "SWR";
        refs.swrScale.textContent = "1.0 \u2013 3.0";
        if (status.swrNoSignal) {
            refs.swrValue.textContent = "no signal";
            setMeter(refs.swrBar, 0, 1);
        } else if (status.swrInfinite) {
            refs.swrValue.textContent = "\u221e";
            setMeter(refs.swrBar, 1, 1);
        } else {
            refs.swrValue.textContent = status.swr.toFixed(2);
            setMeter(refs.swrBar, Math.max(status.swr - 1, 0), 2);
        }
    }
    refs.swrBar.classList.toggle("warn", !flags.operate && (status.swrInfinite || status.swr > 2));

    refs.vaValue.textContent = `${status.supplyVoltage.toFixed(1)} V`;
    setMeter(refs.vaBar, status.supplyVoltage, 60);

    refs.iaValue.textContent = `${status.supplyCurrent.toFixed(1)} A`;
    setMeter(refs.iaBar, status.supplyCurrent, 50);

    const celsius = flags.temperatureCelsius;
    const tempMax = celsius ? 90 : 194;
    refs.tempScale.textContent = celsius ? "0 \u2013 90 \u00b0C" : "32 \u2013 194 \u00b0F";
    refs.tempValue.textContent = `${status.temperature} \u00b0${celsius ? "C" : "F"}`;
    setMeter(refs.tempBar, status.temperature, tempMax);
    refs.tempBar.classList.toggle("warn", status.temperature >= (celsius ? 75 : 167));

    if (status.alarmHistory) {
        renderAlarmHistory(status.alarmHistory);
    }
    renderSetupView(status);
}

function heading(text) {
    const node = document.createElement("h3");
    node.textContent = text;
    return node;
}

function hint(text) {
    const node = document.createElement("p");
    node.className = "hint";
    node.textContent = text;
    return node;
}

function definitionList(entries) {
    const list = document.createElement("dl");
    list.className = "info-grid";
    for (const [term, value] of entries) {
        const wrapper = document.createElement("div");
        const dt = document.createElement("dt");
        dt.textContent = term;
        const dd = document.createElement("dd");
        dd.textContent = value;
        wrapper.append(dt, dd);
        list.append(wrapper);
    }
    return list;
}

function selectionList(items, selectedIndex) {
    const list = document.createElement("ul");
    list.className = "setup-items";
    items.forEach((item, index) => {
        const node = document.createElement("li");
        node.textContent = item;
        if (index === selectedIndex) {
            node.classList.add("current");
            node.setAttribute("aria-current", "true");
        }
        list.append(node);
    });
    return list;
}

function antennaTable(menu) {
    const table = document.createElement("table");
    table.className = "setup-table";
    const head = table.createTHead().insertRow();
    for (const label of ["Band", "Antenna #1", "Antenna #2", "Default"]) {
        const cell = document.createElement("th");
        cell.textContent = label;
        head.append(cell);
    }
    const body = table.createTBody();
    for (const row of menu.rows) {
        const tr = body.insertRow();
        tr.classList.toggle("current", row.selected);
        tr.insertCell().textContent = row.band;
        const first = tr.insertCell();
        first.textContent = row.antenna1;
        first.classList.toggle("is-default", row.defaultAntenna === 1);
        const second = tr.insertCell();
        second.textContent = row.antenna2;
        second.classList.toggle("is-default", row.defaultAntenna === 2);
        tr.insertCell().textContent = `#${row.defaultAntenna}`;
    }
    return table;
}

function renderSetupView(status) {
    const view = refs.setupView;
    const nodes = [];
    const menu = status.setupMenu;

    if (status.catInfo) {
        captured.catInfo = status.catInfo;
    }
    if (menu?.kind === "antenna") {
        captured.antennaMenu = menu;
    }

    if (menu?.kind === "list") {
        nodes.push(heading(menu.title), selectionList(menu.items, menu.selected));
    } else if (menu?.kind === "antenna") {
        nodes.push(heading(menu.title), antennaTable(menu));
        if (menu.saveSelected) {
            nodes.push(hint("SAVE item selected \u2014 press SET to store the antenna map."));
        }
    } else if (status.manualTune) {
        nodes.push(heading("MANUAL TUNE"), definitionList([
            ["Band / sub-band", `${status.band} / ${status.subBand}`],
            ["Lout", `${status.manualTune.inductanceUh.toFixed(1)} \u00b5H`],
            ["Cout", `${status.manualTune.capacitancePf.toFixed(1)} pF`]
        ]));
    } else if (status.backlight !== undefined) {
        nodes.push(heading("BACKLIGHT"));
        const wrapper = document.createElement("div");
        wrapper.className = "meter";
        const head = document.createElement("div");
        head.className = "meter-head";
        const label = document.createElement("span");
        label.textContent = "Intensity";
        const value = document.createElement("b");
        value.textContent = `${status.backlight} / 255`;
        head.append(label, value);
        const track = document.createElement("div");
        track.className = "meter-track";
        const fill = document.createElement("i");
        fill.className = "meter-fill";
        fill.style.width = `${((status.backlight / 255) * 100).toFixed(1)}%`;
        track.append(fill);
        wrapper.append(head, track);
        nodes.push(wrapper);
    } else if (status.catInfo) {
        const { input1, input2, firmwareRelease } = status.catInfo;
        nodes.push(heading("CAT INFO"), definitionList([
            ["Input 1 interface", input1.cat],
            ["Input 1 model", input1.model ?? "\u2014"],
            ["Input 1 baud rate", `${input1.baudRate} Baud`],
            ["Input 2 interface", input2.cat],
            ["Input 2 model", input2.model ?? "\u2014"],
            ["Input 2 baud rate", `${input2.baudRate} Baud`],
            ["Firmware release", firmwareRelease]
        ]));
    } else {
        nodes.push(hint("No setup screen is open. Press SET to enter the SETUP OPTIONS menu."));
    }

    view.replaceChildren(...nodes);
    renderStoredSettings(status);
}

function renderStoredSettings(status) {
    const nodes = [];

    if (captured.catInfo && !status.catInfo) {
        const { input1, input2, firmwareRelease } = captured.catInfo;
        nodes.push(heading("CAT INFO (stored)"), definitionList([
            ["Input 1 interface", input1.cat],
            ["Input 1 model", input1.model ?? "\u2014"],
            ["Input 1 baud rate", `${input1.baudRate} Baud`],
            ["Input 2 interface", input2.cat],
            ["Input 2 model", input2.model ?? "\u2014"],
            ["Input 2 baud rate", `${input2.baudRate} Baud`],
            ["Firmware release", firmwareRelease]
        ]));
    }
    if (captured.antennaMenu && status.setupMenu?.kind !== "antenna") {
        nodes.push(heading("ANTENNA MAP (stored)"), antennaTable(captured.antennaMenu));
    }

    refs.setupStored.replaceChildren(...nodes);
}

function renderAlarmHistory(history) {
    refs.alarmList.replaceChildren();
    if (!history.entries.length) {
        const item = document.createElement("li");
        item.className = "empty";
        item.textContent = "Alarm buffer is empty.";
        refs.alarmList.append(item);
        return;
    }
    for (const entry of [...history.entries].reverse()) {
        const item = document.createElement("li");
        const code = document.createElement("span");
        code.className = "alarm-code";
        code.textContent = `IN ${entry.input} \u00b7 0x${entry.code.toString(16).padStart(2, "0")}`;
        const text = document.createElement("span");
        text.textContent = entry.text;
        item.append(code, text);
        refs.alarmList.append(item);
    }
}

export function appendLog(direction, bytes, note = "") {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    const line = document.createElement("div");
    line.className = `log-line log-${direction}`;
    line.textContent = `${time} ${direction === "tx" ? "\u2192" : "\u2190"} ${toHex(bytes)}${note ? `  ${note}` : ""}`;
    refs.log.append(line);
    while (refs.log.childElementCount > MAX_LOG_LINES) {
        refs.log.firstElementChild.remove();
    }
    refs.log.scrollTop = refs.log.scrollHeight;
}

export function clearLog() {
    refs.log.replaceChildren();
}

export function resetStatus() {
    const pills = [
        refs.operate, refs.tx, refs.tune, refs.alarm, refs.mode, refs.contest, refs.beep,
        refs.barOperate, refs.barTx, refs.barAlarm
    ];
    for (const node of pills) {
        node.classList.remove("pill-on", "pill-tx", "pill-alarm");
        node.classList.add("pill-off");
    }
    refs.operate.textContent = "STANDBY";
    refs.tx.textContent = "RX";
    refs.barOperate.textContent = "STANDBY";
    refs.barTx.textContent = "RX";
    for (const node of [refs.display, refs.input, refs.band, refs.freq, refs.antenna, refs.cat, refs.startup, refs.firmware]) {
        node.textContent = "\u2014";
    }
    for (const node of [refs.paValue, refs.prValue, refs.swrValue, refs.vaValue, refs.iaValue, refs.tempValue]) {
        node.textContent = "\u2014";
    }
    for (const bar of [refs.paBar, refs.prBar, refs.swrBar, refs.vaBar, refs.iaBar, refs.tempBar]) {
        bar.style.width = "0%";
    }
    refs.setupView.replaceChildren(
        hint("No setup screen is open. Press SET to enter the SETUP OPTIONS menu.")
    );
    captured = { catInfo: null, antennaMenu: null };
    refs.setupStored.replaceChildren();
}
