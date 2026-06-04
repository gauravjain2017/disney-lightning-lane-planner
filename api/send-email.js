import formidable from 'formidable';
import nodemailer from 'nodemailer';

export const config = {
    api: { bodyParser: false }
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, data: 'Method not allowed' });
    }

    try {
        const form = formidable();
        const [fields] = await form.parse(req);

        const email = Array.isArray(fields.email) ? fields.email[0] : fields.email;
        const selectionsRaw = Array.isArray(fields.selections) ? fields.selections[0] : fields.selections;

        if (!email || !email.includes('@') || !email.includes('.')) {
            return res.status(400).json({ success: false, data: 'Please provide a valid email address.' });
        }

        let selections;
        try {
            selections = JSON.parse(selectionsRaw);
        } catch {
            return res.status(400).json({ success: false, data: 'Invalid selection data.' });
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: email,
            subject: 'My Disney World Lightning Lane Plan',
            html: buildEmailHtml(selections)
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Email send error:', error);
        return res.status(500).json({ success: false, data: 'Failed to send email. Please try again.' });
    }
}

const parkNames  = { mk: 'Magic Kingdom', epcot: 'EPCOT', hs: 'Hollywood Studios', ak: 'Animal Kingdom' };
const parkIcons  = { mk: '&#x1F3F0;', epcot: '&#x1F310;', hs: '&#x1F3AC;', ak: '&#x1F981;' };
const parkColors = { mk: '#4a1a7a', epcot: '#0891b2', hs: '#dc2626', ak: '#16a34a' };
const waitColors = {
    high:   { bg: '#fee2e2', text: '#ef4444' },
    medium: { bg: '#fef3c7', text: '#b45309' },
    low:    { bg: '#dcfce7', text: '#15803d' }
};

function buildEmailHtml(selections) {
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    let hasSelections = false;
    for (const park of Object.values(selections)) {
        for (const tier of Object.values(park)) {
            if (Array.isArray(tier) && tier.length > 0) { hasSelections = true; break; }
        }
        if (hasSelections) break;
    }

    let body = '';

    if (!hasSelections) {
        body = `<tr><td style="padding:50px 30px;text-align:center;color:#64748b;font-size:15px;">
            <p style="font-size:48px;margin-bottom:12px;">&#x1F3A2;</p><p>No attractions were selected.</p></td></tr>`;
    } else {
        body += '<tr><td style="padding:24px 24px 0;">';

        for (const [park, tiers] of Object.entries(selections)) {
            if (!parkNames[park]) continue;
            const hasPark = Object.values(tiers).some(r => Array.isArray(r) && r.length > 0);
            if (!hasPark) continue;

            const color = parkColors[park];
            const icon  = parkIcons[park];

            body += `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                <tr><td style="background:${color};padding:14px 20px;color:#ffffff;font-size:16px;font-weight:700;">${icon} ${parkNames[park]}</td></tr>
                <tr><td style="padding:16px 20px;">`;

            for (const [tier, rides] of Object.entries(tiers)) {
                if (!Array.isArray(rides) || rides.length === 0) continue;

                const tierLabel =
                    tier === 'tier1'  ? 'Tier 1 &mdash; Multi Pass' :
                    tier === 'tier2'  ? 'Tier 2 &mdash; Multi Pass' :
                    tier === 'multi'  ? 'Multi Pass' :
                    'Single Pass (Additional Cost)';

                body += `<p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin:12px 0 8px;padding-bottom:4px;border-bottom:1px dashed #e2e8f0;">${tierLabel}</p>`;

                rides.forEach((ride, i) => {
                    const name   = ride.name   || '';
                    const wait   = ride.wait   || '';
                    const note   = ride.note   || '';
                    const wclass = ride.waitClass || 'low';
                    const wc     = waitColors[wclass] || waitColors.low;
                    const rowBg  = i % 2 === 1 ? '#f8fafc' : '#ffffff';

                    body += `<table width="100%" cellpadding="0" cellspacing="0" style="background:${rowBg};border-radius:6px;margin-bottom:2px;"><tr>
                        <td style="padding:10px 12px;width:28px;vertical-align:top;">
                            <span style="display:inline-block;width:22px;height:22px;background:#22c55e;border-radius:50%;text-align:center;line-height:22px;color:#fff;font-size:12px;font-weight:700;">&#10003;</span>
                        </td>
                        <td style="padding:10px 6px;font-size:14px;font-weight:600;color:#1e293b;">${name}${note ? `<br><span style="font-size:12px;font-weight:400;color:#F5A623;font-style:italic;">${note}</span>` : ''}</td>
                        ${wait ? `<td style="padding:10px 12px;text-align:right;white-space:nowrap;width:80px;vertical-align:top;"><span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${wc.bg};color:${wc.text};">${wait}</span></td>` : ''}
                    </tr></table>`;
                });
            }

            body += '</td></tr></table>';
        }

        // Checklist
        const checklist = [
            '&#x1F4F1; Download My Disney Experience App',
            '&#x1F468;&#x200D;&#x1F469;&#x200D;&#x1F467;&#x200D;&#x1F466; Link all party members',
            '&#x1F4B3; Verify payment method',
            '&#x23F0; Set alarm for 6:55 AM ET',
            '&#x1F4F6; Use strong WiFi connection',
            '&#x1F4CB; Know your priority picks'
        ];

        body += `<table width="100%" cellpadding="0" cellspacing="0" style="background:#E8F4FD;border-radius:12px;margin-bottom:8px;">
            <tr><td style="padding:20px;">
                <p style="font-size:15px;font-weight:700;color:#1a5a94;margin:0 0 14px;">&#x2705; Pre-Booking Day Checklist</p>
                <table width="100%" cellpadding="0" cellspacing="0">`;

        for (let r = 0; r < checklist.length; r += 2) {
            body += `<tr>
                <td style="padding:4px 8px;font-size:12px;color:#334155;width:50%;">${checklist[r]}</td>
                <td style="padding:4px 8px;font-size:12px;color:#334155;width:50%;">${checklist[r + 1] || ''}</td>
            </tr>`;
        }

        body += `</table></td></tr></table></td></tr>`;
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f0f7fe;font-family:Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f7fe;padding:30px 10px;"><tr><td align="center">
<table width="800" cellpadding="0" cellspacing="0" style="max-width:800px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
    <tr><td style="background:linear-gradient(135deg,#1a5a94 0%,#2B7DC9 50%,#6AB3F8 100%);padding:40px 30px;text-align:center;">
        <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;"><span style="color:#F5A623;">Lightning Lane</span> Planner</h1>
        <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.9);">Walt Disney World &mdash; My Personal Ride Plan</p>
        <p style="margin:14px 0 0;"><span style="display:inline-block;background:#E8F4FD;color:#1a5a94;padding:5px 16px;border-radius:20px;font-size:12px;font-weight:600;">&#x1F4C5; ${dateStr}</span></p>
    </td></tr>
    ${body}
    <tr><td style="padding:24px 30px;text-align:center;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
        <p style="margin:6px 0 0;">Your Disney World vacation planning experts</p>
    </td></tr>
</table>
</td></tr></table>
</body></html>`;
}
