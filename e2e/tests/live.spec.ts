import { expect, test } from '@playwright/test';
import { URLS } from '../playwright.config';
import { api, asPerson, freshSkill, publishedRequest, signIn, student, unique, verifiedTutor } from './helpers';

const LIVEKIT = process.env.E2E_LIVEKIT_HTTP ?? 'http://127.0.0.1:7880';

/** Two real browsers (fake camera and mic) join the LiveKit room through the app UI. */
test('tutor and learner join the live room, switch to audio only, and leave', async ({ browser }) => {
  const up = await fetch(LIVEKIT).then(
    () => true,
    () => false,
  );
  test.skip(!up, `LiveKit is not reachable at ${LIVEKIT}`);

  const skill = await freshSkill('Live Room');
  const tutorName = `Dev ${unique()}`;
  const [tutor, learner] = await Promise.all([verifiedTutor(skill.id, tutorName), student('Nisha Rao')]);
  const req = await publishedRequest(learner, skill.id, {
    title: `Live check ${unique()}`,
    description: 'Checking the live room end to end with two browsers.',
  });
  // The earliest start the backend accepts; the room opens 15 minutes before it, i.e. now.
  const startAt = new Date(Date.now() + 15 * 60_000 + 20_000).toISOString();
  const bid = await api<{ id: string }>(URLS.tutor, 'POST', `/tutor/requests/${req.id}/bids`, tutor.accessToken, {
    seatPricePaise: 30000,
    proposedStartAt: startAt,
    durationMinutes: 15,
    approachText: 'Quick live check.',
  });
  const seat = await api<{ sessionId: string; participantId: string }>(
    URLS.student, 'POST', `/student/bids/${bid.id}/accept`, learner.accessToken,
  );
  const pay = await api<{ id: string; checkout: { orderId: string } }>(
    URLS.student, 'POST', `/student/participants/${seat.participantId}/payments`, learner.accessToken,
    undefined, { 'Idempotency-Key': `pw-${seat.participantId}` },
  );
  await api(URLS.student, 'POST', `/dev/fake-upi/orders/${pay.checkout.orderId}/pay`, null, {});
  await expect
    .poll(async () => (await api<{ status: string }>(URLS.student, 'GET', `/student/payments/${pay.id}`, learner.accessToken)).status, { timeout: 30_000 })
    .toBe('HELD');

  const T = await asPerson(browser);
  const L = await asPerson(browser);
  await signIn(T.page, 'tutor', tutor, `/sessions/${seat.sessionId}`);
  await signIn(L.page, 'student', learner, `/sessions/${seat.sessionId}`);

  // Window time: give the room a moment past the open threshold.
  for (const p of [T.page, L.page]) {
    await expect(p.getByText(/Room is open|Live now/)).toBeVisible({ timeout: 40_000 });
    await p.getByRole('button', { name: "Don't record" }).click();
  }
  await T.page.getByRole('button', { name: 'Join now' }).click();
  await L.page.getByRole('button', { name: 'Join now' }).click();

  for (const p of [T.page, L.page]) {
    const room = p.getByRole('region', { name: 'Live session' });
    await expect(room.getByText('● Live')).toBeVisible({ timeout: 30_000 });
    await expect(room.getByText('2 in the room')).toBeVisible({ timeout: 30_000 });
  }
  // The learner sees the tutor's real video (fake camera frames are decoding).
  await expect
    .poll(
      () =>
        // LiveKit mutes video elements (sound plays through a separate audio element), so look
        // for decoded frames in the remote tile rather than at the muted flag.
        L.page
          .getByRole('figure', { name: tutorName.split(' ')[0] })
          .locator('video')
          .evaluate((v: HTMLVideoElement) => v.videoWidth > 0 && !v.paused),
      { timeout: 30_000 },
    )
    .toBe(true);

  // Low-bandwidth switch on the learner side.
  const modes = L.page.getByRole('group', { name: 'Bandwidth mode' });
  await modes.getByRole('button', { name: /audio/i }).click();
  await expect(modes.getByRole('button', { name: /audio/i })).toHaveAttribute('aria-pressed', 'true');

  await L.page.getByRole('button', { name: 'Leave' }).click();
  await expect(T.page.getByRole('region', { name: 'Live session' }).getByText('1 in the room')).toBeVisible({
    timeout: 30_000,
  });
  await T.page.getByRole('button', { name: 'Leave' }).click();
  await Promise.all([T.ctx.close(), L.ctx.close()]);
});
