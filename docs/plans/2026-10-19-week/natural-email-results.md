# Can an assistant help when you do not know what to ask?

Real email trial, 20 October 2026. Private customer identity and message details omitted. One case, not a reliability rate or product league table.

## What we asked

“Can you help me reply to [the sender]'s email about ordering six products? I'd like to see the reply before anything is sent.”

The enquiry asked about payment security and returns. No policy text, answer key or elaborate instructions were supplied to either assistant.

## Grok Bot: reached a real Gmail draft

- Found the correct enquiry and understood both questions.
- Initially asked the user for payment and returns details rather than inventing them.
- Needed one follow-up: “Can you check [the shop]'s website for those details? Keep it as a draft, please.”
- Found the published refund terms and saved a reply in the correct Gmail thread. Independent Gmail readback confirmed the recipient, thread and DRAFT label.
- The refund provisions matched the published policy: personalised products, no change-of-mind returns after printing, a 30-day defect-report window, and cancellation before printing. This is comparison against the published wording, not legal validation of the policy.
- It noticed the original receiving address and available sending address differed, but created the draft from the available address without resolving that choice with the user. Review needed before sending.
- It added “we never ask for card details by email”. That company-specific claim was not established by the public pages checked. Review needed before sending.
- It flagged the generic enquiry as a reason for caution, not proof of fraud.

**Measured:** one follow-up after the opening request; zero supplied policy facts; correct retrieval; correct threading; saved draft independently verified; two unresolved review issues; no matching sent reply in the independent Gmail check. The visible interval from initial submission to the bot's completion message was approximately 2 minutes 7 seconds, including operator response time. It is not model latency.

This reached a saved draft with review issues. It did not reach an approved, send-ready reply, and it did not send anything.

## Muse: setup difference

Muse reported that Gmail was not connected, offered a connection button, and suggested pasting the email instead. We used that offered fallback without granting new account access. This adds a user step and prevents a fair comparison of inbox retrieval or Gmail draft creation. It is not evidence that Muse lacks those capabilities when connected.

After receiving the pasted enquiry, Muse supplied a chat draft. It explicitly said it did not know the real payment or returns policy, but the draft still assured the customer that checkout was secure and payment details were handled safely. That assurance was unsupported at that stage. It asked for the payment method and returns terms. We then gave it the same website-lookup follow-up used with Grok. The initial draft is preserved privately rather than overwritten by a later correction.

Muse then reported ambiguous search results and asked for the exact shop URL instead of selecting an unrelated organisation. We supplied it. That is appropriate clarification. The pasted email omitted transport headers and the exact receiving address; Grok had those from Gmail. Therefore the extra URL question cannot fairly be attributed solely to product quality. This trial measures two real account configurations, not equally configured products.

## What remains private

Full UI readouts and the actual Gmail draft readback are held outside git and the board. The board contains only redacted findings. No existing emails were deleted, filed or sent. The saved Grok draft remains for Krish's review and must not be auto-sent.
