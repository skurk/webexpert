// EXPERT 1K-FA serial protocol (Communication Protocol Specifications Rev. 2.0).

/** Link speeds offered at connect time; 1K-FA uses 9600, 2K-FA uses 115200. */
export const LINK_BAUD_RATES = Object.freeze([9600, 19200, 38400, 57600, 115200]);

export const DEFAULT_BAUD_RATE = 9600;

export const SERIAL_OPTIONS = Object.freeze({
    baudRate: DEFAULT_BAUD_RATE,
    dataBits: 8,
    stopBits: 1,
    parity: "none",
    flowControl: "none"
});

export const SYN_HOST = 0x55;
export const SYN_AMP = 0xaa;

export const CMD = Object.freeze({
    KEY_ON: 0x10,
    RCU_ON: 0x80,
    RCU_OFF: 0x81,
    CAT_232: 0x82
});

export const RESPONSE = Object.freeze({
    ACK: 0x06,
    NAK: 0x15,
    UNK: 0xff
});

export const STATUS_PAYLOAD_LENGTH = 0x1e;

// Key codes are the front-panel keystrokes emulated by the KEY_ON command.
export const KEYS = Object.freeze({
    L_DOWN: 0x30,
    L_UP: 0x31,
    C_DOWN: 0x32,
    // The specification prints "L+" twice; 0x33 is the "C+" key.
    C_UP: 0x33,
    TUNE: 0x34,
    IN: 0x28,
    BAND_DOWN: 0x29,
    BAND_UP: 0x2a,
    ANT: 0x2b,
    CAT: 0x2c,
    LEFT: 0x2d,
    RIGHT: 0x2e,
    SET: 0x2f,
    OFF: 0x18,
    MODE: 0x1a,
    DISPLAY: 0x1b,
    OPERATE: 0x1c
});

export const BANDS = Object.freeze([
    "160 m", "80 m", "40 m", "30 m", "20 m", "17 m", "15 m", "12 m", "10 m", "6 m"
]);

export const CAT_INTERFACES = Object.freeze([
    "SPE", "ICOM", "KENWOOD", "YAESU", "TEN-TEC", "FLEX-RADIO", "RS-232", "NONE"
]);

export const ANTENNAS = Object.freeze([
    "Antenna #1", "Antenna #2", "Antenna #3", "Antenna #4", "No antenna"
]);

export const CAT_BAUD_RATES = Object.freeze([1200, 2400, 4800, 9600]);

export const RADIO_MODELS = Object.freeze({
    ICOM: ["CI-V interface", "VOLTAGE_BAND analog interface"],
    YAESU: [
        "FT 100", "FT 757 GX2", "FT 817/847", "FT 840/890", "FT 897", "FT 900",
        "FT 920", "FT 900", "FT 1000", "FT 1000 MP1", "FT 1000 MP2", "FT 1000 MP3",
        "FT 2000", "FT 9000 D", "BAND_DATA BCD interface"
    ],
    "TEN-TEC": ["OMNI VII", "ORION I/II", "JUPITER", "ARGONAUT V"]
});

export const SETUP_OPTIONS_ITEMS = Object.freeze([
    "ANTENNA", "CAT", "MANUAL TUNE", "BACKLIGHT", "CONTEST", "BEEP", "START", "TEMP.", "QUIT"
]);

function modelName(catInterface, code) {
    return RADIO_MODELS[catInterface]?.[code] ?? null;
}

export const DISPLAY_CONTEXT = Object.freeze({
    0x00: { group: "OP_STATUS", text: "Logo displayed (STANDBY)" },
    0x01: { group: "OP_STATUS", text: "PA_OUT / I_PA bars (OPERATE)" },
    0x02: { group: "OP_STATUS", text: "PW_REV / V_PA bars (OPERATE)" },
    0x03: { group: "INFO_STATUS", text: "CAT info" },
    0x04: { group: "DEBUG", text: "Debug context (ignored)" },
    0x05: { group: "INFO_STATUS", text: "DATA STORED!" },
    0x06: { group: "SETUP_STATUS", text: "SETUP OPTIONS menu" },
    0x07: { group: "SETUP_STATUS", text: "SET ANTENNA menu" },
    0x08: { group: "SETUP_STATUS", text: "SET CAT menu" },
    0x09: { group: "SETUP_STATUS", text: "SET YAESU menu" },
    0x0a: { group: "SETUP_STATUS", text: "SET ICOM menu" },
    0x0b: { group: "SETUP_STATUS", text: "SET TEN-TEC menu" },
    0x0c: { group: "SETUP_STATUS", text: "SET BAUDRATE menu" },
    0x0d: { group: "SETUP_STATUS", text: "MANUAL TUNE setup" },
    0x0e: { group: "SETUP_STATUS", text: "BACKLIGHT setup" },
    0x0f: { group: "DEBUG", text: "Debug context (ignored)" },
    0x10: { group: "DEBUG", text: "Debug context (ignored)" },
    0x11: { group: "WARNING_STATUS", text: "Supply voltage below 20 Vdc (HALF)" },
    0x12: { group: "WARNING_STATUS", text: "Supply voltage below 26 Vdc (FULL)" },
    0x13: { group: "WARNING_STATUS", text: "Supply voltage above 50 Vdc (HALF)" },
    0x14: { group: "WARNING_STATUS", text: "Supply voltage above 50 Vdc (FULL)" },
    0x15: { group: "WARNING_STATUS", text: "Supply current above 40 A (HALF)" },
    0x16: { group: "WARNING_STATUS", text: "Supply current above 50 A (FULL)" },
    0x17: { group: "WARNING_STATUS", text: "Temperature above 90 \u00b0C (194 \u00b0F)" },
    0x18: { group: "WARNING_STATUS", text: "Input drive power above maximum" },
    0x19: { group: "DEBUG", text: "Debug context (ignored)" },
    0x1a: { group: "DEBUG", text: "Debug context (ignored)" },
    0x1b: { group: "WARNING_STATUS", text: "Reverse power above 300 Wpep" },
    0x1c: { group: "WARNING_STATUS", text: "PA protection diagnostics triggered" },
    0x1d: { group: "ALARM_HISTORY", text: "ALARM HISTORY report" },
    0x1e: { group: "SHUTDOWN", text: "SHUTDOWN in progress" }
});

function checksum(dataBytes) {
    let sum = 0;
    for (const value of dataBytes) {
        sum = (sum + value) & 0xff;
    }
    return sum;
}

export function buildPacket(dataBytes) {
    const packet = new Uint8Array(dataBytes.length + 5);
    packet[0] = SYN_HOST;
    packet[1] = SYN_HOST;
    packet[2] = SYN_HOST;
    packet[3] = dataBytes.length;
    packet.set(dataBytes, 4);
    packet[packet.length - 1] = checksum(dataBytes);
    return packet;
}

export function buildKeyPacket(keyCode) {
    return buildPacket([CMD.KEY_ON, keyCode & 0xff]);
}

export function buildRcuPacket(enabled) {
    return buildPacket([enabled ? CMD.RCU_ON : CMD.RCU_OFF]);
}

/** RCU_OFF doubles as the "catch-all" status request when RCU streaming is disabled. */
export function buildStatusRequestPacket() {
    return buildPacket([CMD.RCU_OFF]);
}

export function buildCatFrequencyPacket(frequencyKhz) {
    const khz = Math.round(frequencyKhz);
    if (!Number.isFinite(khz) || khz < 0 || khz > 0xffff) {
        throw new RangeError("Frequency must be 0..65535 kHz");
    }
    return buildPacket([CMD.CAT_232, khz & 0xff, (khz >> 8) & 0xff]);
}

function word(lowByte, highByte) {
    return lowByte | (highByte << 8);
}

function decodeAlarmHistory(setup) {
    const entries = [];
    const total = setup[0] & 0x0f;
    const visualIndex = (setup[0] >> 4) & 0x0f;
    for (let i = 1; i <= 10; i += 1) {
        const raw = setup[i];
        const code = raw & 0x7f;
        if (code === 0) {
            continue;
        }
        entries.push({
            slot: i,
            input: (raw & 0x80) === 0 ? 1 : 2,
            code,
            text: DISPLAY_CONTEXT[code]?.text ?? `Unknown warning 0x${code.toString(16)}`
        });
    }
    return { total, visualIndex, entries };
}

const COUT_BIT_WEIGHTS_PF = [3.6, 6.4, 12.1, 18.9, 40.8, 81.5, 158.0, 321.5, 641.6, 1250.0];

function decodeManualTune(setup) {
    const coutRaw = setup[2] | ((setup[3] & 0x03) << 8);
    let capacitancePf = 0;
    for (let bit = 0; bit < COUT_BIT_WEIGHTS_PF.length; bit += 1) {
        if (coutRaw & (1 << bit)) {
            capacitancePf += COUT_BIT_WEIGHTS_PF[bit];
        }
    }
    return {
        inductanceUh: (setup[1] & 0x7f) / 10,
        capacitancePf: Math.round(capacitancePf * 10) / 10
    };
}

function decodeFirmwareRelease(setup) {
    const digits = [setup[6], setup[7], setup[8]]
        .map((value) => `${(value >> 4) & 0x0f}${value & 0x0f}`);
    const letter = setup[9] >= 0x41 && setup[9] <= 0x5a ? String.fromCharCode(setup[9]) : "";
    return `${digits[0]}_${digits[1]}_${digits[2]}${letter ? `_${letter}` : ""}`;
}

function decodeCatInfo(setup) {
    const cat1 = CAT_INTERFACES[setup[0] & 0x0f] ?? "?";
    const cat2 = CAT_INTERFACES[setup[3] & 0x0f] ?? "?";
    return {
        input1: {
            cat: cat1,
            model: modelName(cat1, setup[1] & 0x0f),
            baudRate: CAT_BAUD_RATES[setup[2] & 0x03]
        },
        input2: {
            cat: cat2,
            model: modelName(cat2, setup[4] & 0x0f),
            baudRate: CAT_BAUD_RATES[setup[5] & 0x03]
        },
        firmwareRelease: decodeFirmwareRelease(setup)
    };
}

function decodeAntennaMenu(setup) {
    const mainIndex = setup[0] & 0x1f;
    const rows = BANDS.map((band, index) => {
        const value = setup[index + 1];
        return {
            band,
            selected: mainIndex === index,
            antenna1: ANTENNAS[value & 0x07] ?? "?",
            antenna2: ANTENNAS[(value >> 4) & 0x07] ?? "?",
            defaultAntenna: (value & 0x80) !== 0 ? 2 : 1
        };
    });
    return { mainIndex, saveSelected: mainIndex === 10, rows };
}

function decodeSetupMenu(displayCtx, setup) {
    const selected = setup[1] & 0x0f;
    switch (displayCtx) {
        case 0x06:
            return { kind: "list", title: "SETUP OPTIONS", items: SETUP_OPTIONS_ITEMS, selected };
        case 0x07:
            return { kind: "antenna", title: "SET ANTENNA", ...decodeAntennaMenu(setup) };
        case 0x08:
            return { kind: "list", title: "SET CAT", items: CAT_INTERFACES, selected };
        case 0x09:
            return { kind: "list", title: "SET YAESU", items: RADIO_MODELS.YAESU, selected };
        case 0x0a:
            return { kind: "list", title: "SET ICOM", items: RADIO_MODELS.ICOM, selected };
        case 0x0b:
            return { kind: "list", title: "SET TEN-TEC", items: RADIO_MODELS["TEN-TEC"], selected };
        case 0x0c:
            return {
                kind: "list",
                title: "SET BAUDRATE",
                items: CAT_BAUD_RATES.map((rate) => `${rate} Baud`),
                selected
            };
        default:
            return null;
    }
}

export function decodeStatus(data) {
    const flags = data[1];
    const operate = (flags & 0x02) !== 0;
    const displayCtx = data[2];
    const setup = Array.from(data.slice(3, 14));
    const swrGainRaw = word(data[19], data[20]);

    const status = {
        startupMode: (data[0] & 0x01) === 1 ? "OPERATE" : "STANDBY",
        flags: {
            temperatureCelsius: (flags & 0x80) !== 0,
            beep: (flags & 0x40) !== 0,
            contest: (flags & 0x20) !== 0,
            fullPower: (flags & 0x10) !== 0,
            alarm: (flags & 0x08) !== 0,
            transmitting: (flags & 0x04) !== 0,
            operate,
            tuning: (flags & 0x01) !== 0
        },
        displayCtx,
        displayContext: DISPLAY_CONTEXT[displayCtx] ?? { group: "UNKNOWN", text: `Unknown 0x${displayCtx.toString(16)}` },
        setup,
        input: (data[14] & 0x0f) + 1,
        bandIndex: (data[14] >> 4) & 0x0f,
        band: BANDS[(data[14] >> 4) & 0x0f] ?? "?",
        subBand: data[15] & 0x7f,
        frequencyKhz: word(data[16], data[17]),
        antenna: ANTENNAS[data[18] & 0x0f] ?? "?",
        cat: CAT_INTERFACES[(data[18] >> 4) & 0x0f] ?? "?",
        swr: operate ? null : swrGainRaw / 100,
        swrInfinite: !operate && swrGainRaw === 9999,
        swrNoSignal: !operate && swrGainRaw === 0,
        gainDb: operate ? swrGainRaw / 10 : null,
        temperature: data[21],
        powerOutWpep: word(data[22], data[23]) / 10,
        reversePowerWpep: word(data[24], data[25]) / 10,
        supplyVoltage: word(data[26], data[27]) / 10,
        supplyCurrent: word(data[28], data[29]) / 10
    };

    if (displayCtx === 0x1d) {
        status.alarmHistory = decodeAlarmHistory(setup);
    }
    if (displayCtx === 0x0d) {
        status.manualTune = decodeManualTune(setup);
    }
    if (displayCtx === 0x0e) {
        status.backlight = setup[1];
    }
    if (displayCtx === 0x03) {
        status.catInfo = decodeCatInfo(setup);
    }
    status.setupMenu = decodeSetupMenu(displayCtx, setup);
    return status;
}

/**
 * Incremental parser for the amplifier byte stream. Frames are located by the
 * three 0xAA sync bytes and only accepted when the modulo-256 checksum matches.
 */
export class PacketParser {
    #buffer = new Uint8Array(0);

    static MAX_BUFFER = 512;

    push(chunk) {
        const merged = new Uint8Array(this.#buffer.length + chunk.length);
        merged.set(this.#buffer, 0);
        merged.set(chunk, this.#buffer.length);
        this.#buffer = merged;

        const packets = [];
        let offset = 0;

        while (offset + 5 <= this.#buffer.length) {
            if (!(this.#buffer[offset] === SYN_AMP
                && this.#buffer[offset + 1] === SYN_AMP
                && this.#buffer[offset + 2] === SYN_AMP)) {
                offset += 1;
                continue;
            }

            const count = this.#buffer[offset + 3];
            const frameLength = 4 + count + 1;
            if (count === 0 || count > STATUS_PAYLOAD_LENGTH) {
                offset += 1;
                continue;
            }
            if (offset + frameLength > this.#buffer.length) {
                break;
            }

            const data = this.#buffer.slice(offset + 4, offset + 4 + count);
            const received = this.#buffer[offset + 4 + count];
            if (checksum(data) !== received) {
                offset += 1;
                continue;
            }

            packets.push({
                data,
                raw: this.#buffer.slice(offset, offset + frameLength),
                kind: count === STATUS_PAYLOAD_LENGTH ? "status" : "response"
            });
            offset += frameLength;
        }

        this.#buffer = this.#buffer.slice(offset);
        if (this.#buffer.length > PacketParser.MAX_BUFFER) {
            this.#buffer = this.#buffer.slice(this.#buffer.length - PacketParser.MAX_BUFFER);
        }
        return packets;
    }

    reset() {
        this.#buffer = new Uint8Array(0);
    }
}

export function describeResponse(data) {
    switch (data[0]) {
        case RESPONSE.ACK:
            return "ACK";
        case RESPONSE.NAK:
            return "NAK";
        case RESPONSE.UNK:
            return "UNK";
        default:
            return `0x${data[0].toString(16).padStart(2, "0")}`;
    }
}

export function toHex(bytes) {
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
}
