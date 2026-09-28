"use client";

import { useState, useTransition } from "react";
import { logContact } from "@/app/dashboard/actions";
import { IconMail, IconPhone, IconWhatsApp } from "@/components/icons";

interface Props {
  reviewId: string;
  phone: string | null; // 10-digit Indian mobile
  email: string | null;
  waTemplate: string;
  emailSubject: string;
  emailBody: string;
  followUp: string | null; // shown when the complaint is resolved
}

export function ContactActions(p: Props) {
  const [composing, setComposing] = useState(false);
  const [text, setText] = useState(p.waTemplate);
  const [, start] = useTransition();
  const log = (channel: string) => start(() => logContact(p.reviewId, channel));
  const wa = (msg: string) => `https://wa.me/91${p.phone}?text=${encodeURIComponent(msg)}`;

  return (
    <>
      <div className="actions">
        <button type="button" className="act wa" disabled={!p.phone} aria-disabled={!p.phone} title={p.phone ? undefined : "The customer didn't share a phone number"} onClick={() => setComposing(true)}>
          <IconWhatsApp /> WhatsApp
        </button>
        <a className="act" href={p.phone ? `tel:+91${p.phone}` : undefined} aria-disabled={!p.phone} onClick={() => p.phone && log("call")}>
          <IconPhone /> Call
        </a>
        <a
          className="act"
          href={p.email ? `mailto:${p.email}?subject=${encodeURIComponent(p.emailSubject)}&body=${encodeURIComponent(p.emailBody)}` : undefined}
          aria-disabled={!p.email}
          onClick={() => p.email && log("email")}
        >
          <IconMail /> Email
        </a>
      </div>
      {!p.phone && !p.email && <div className="info">This customer didn’t leave contact details. Use a note to record what the team changed.</div>}
      {composing && p.phone && (
        <div className="compose">
          <label className="sub-h" htmlFor="wa-text">WhatsApp message (edit before sending)</label>
          <div className="field"><textarea id="wa-text" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} /></div>
          <div className="toolbar">
            <a className="btn" href={wa(text)} target="_blank" rel="noopener noreferrer" onClick={() => { log("whatsapp"); setComposing(false); }}>
              <IconWhatsApp /> Open in WhatsApp
            </a>
            <button type="button" className="btn-ghost" onClick={() => setComposing(false)}>Cancel</button>
          </div>
        </div>
      )}
      {p.followUp && p.phone && (
        <div className="followup">
          <b>Send a thank-you follow-up</b>
          <span>{p.followUp}</span>
          <span className="help">Every resolved customer gets this same message, with the Google review link.</span>
          <div className="toolbar">
            <a className="btn" href={wa(p.followUp)} target="_blank" rel="noopener noreferrer" onClick={() => log("followup")}>
              <IconWhatsApp /> Send on WhatsApp
            </a>
          </div>
        </div>
      )}
    </>
  );
}
