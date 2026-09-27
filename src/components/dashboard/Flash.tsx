const MESSAGES: Record<string, string> = {
  "saved:1": "Changes saved.",
  "saved:created": "Created.",
  "saved:logo": "Logo updated.",
  "saved:ai": "Saved. New review suggestions are being written in the background.",
  "saved:regenerated": "New review suggestions are ready.",
  "saved:archived": "Archived.",
  "saved:branch-archived": "Branch archived. Its QR codes now show an “isn’t active” page.",
  "saved:invited": "Invitation saved. They can now sign in with Google using that email.",
  "saved:removed": "Removed from the team and signed out.",
  "saved:photo": "Photo saved. It has been cropped to a passport-style portrait.",
  "saved:photo-removed": "Photo removed.",
  "error:staff-details": "Check the details: name is required; employee ID can use letters, numbers and dashes.",
  "error:staff-phone": "Enter a 10-digit mobile number for the emergency contact, or leave it empty.",
  "error:staff-code": "Another staff member already has that employee ID.",
  "error:staff-consent": "Please confirm the employee agreed to their photo being used on the ID card.",
  "error:staff-photo-size": "That photo is larger than 4 MB. Please choose a smaller file.",
  "error:business": "Check the business details: name, category and tone are required, and the colour must be a hex value like #0E6B63.",
  "error:branch": "Check the branch details: name, area, a Google review link (https://…google…) and at least one language are required. The Facebook link, if given, must be a facebook.com address.",
  "error:branch-limit": "Your plan’s branch limit is reached. Contact Synergy Technologies to upgrade.",
  "error:logo-missing": "Choose an image file first.",
  "error:logo-size": "That image is larger than 2 MB. Please choose a smaller file.",
  "error:logo-type": "Use a PNG, JPG or WebP image.",
  "error:staff": "Enter a staff name (up to 40 characters).",
  "error:regen-limit": "Suggestions were regenerated several times in the last hour. Try again later.",
  "error:invite": "Enter a valid email and pick at least one branch for a Branch Admin.",
  "error:last-owner": "An account needs at least one Client Owner.",
};

export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const saved = typeof sp.saved === "string" ? MESSAGES[`saved:${sp.saved}`] : undefined;
  const error = typeof sp.error === "string" ? MESSAGES[`error:${sp.error}`] : undefined;
  if (error) return <div className="flash error" role="alert">{error}</div>;
  if (saved) return <div className="flash" role="status">{saved}</div>;
  return null;
}
