import { expect, test } from '@playwright/test';
import { FAKE_CAMERA_LAUNCH_ARGS, connectGuest, newHostAndContext, openInvitation } from './support/remoteGuest';

// The same invitation as in remoteGuests.spec.ts, but with the browser's own WebRTC. It needs a machine on which two pages can reach each
// other over UDP; where that is blocked (a sandbox, a strict firewall) the test says so and skips, leaving it unverified rather than passed.

test.use({ launchOptions: { args: [...FAKE_CAMERA_LAUNCH_ARGS, '--allow-loopback-in-peer-connection'] } });
test.setTimeout(90_000);

const PROBE_SECONDS = 6;

async function machineConnectsPeers(page: import('@playwright/test').Page): Promise<boolean> {
  await page.goto('about:blank');
  return page.evaluate(async (seconds) => {
    const connect = (): RTCPeerConnection => {
      const peer = new RTCPeerConnection({ iceServers: [] });
      peer.createDataChannel('probe', { id: 0, negotiated: true });
      return peer;
    };
    const first = connect();
    const second = connect();
    const opened = new Promise<boolean>((resolve) => {
      first.addEventListener('connectionstatechange', () => first.connectionState === 'connected' && resolve(true));
      window.setTimeout(() => resolve(false), seconds * 1000);
    });
    const gathered = (peer: RTCPeerConnection): Promise<void> =>
      new Promise((resolve) => {
        if (peer.iceGatheringState === 'complete') resolve();
        peer.addEventListener('icegatheringstatechange', () => peer.iceGatheringState === 'complete' && resolve());
      });
    await first.setLocalDescription(await first.createOffer());
    await gathered(first);
    await second.setRemoteDescription(first.localDescription!);
    await second.setLocalDescription(await second.createAnswer());
    await gathered(second);
    await first.setRemoteDescription(second.localDescription!);
    return opened;
  }, PROBE_SECONDS);
}

test("a guest joins with the browser's own WebRTC connection", async ({ browser }) => {
  const probeContext = await browser.newContext();
  const reachable = await machineConnectsPeers(await probeContext.newPage());
  await probeContext.close();
  test.skip(!reachable, 'Not verified: this machine cannot establish a WebRTC connection between two pages (UDP may be blocked).');

  const { host, context } = await newHostAndContext(browser, true);
  await openInvitation(host);
  const guest = await connectGuest(host, context);
  expect(await host.evaluate(() => window.__game.getState().playerSources)).toEqual(['gamepad', 'remote']);
  await expect.poll(() => guest.evaluate(() => (window.__guest!.getState() as { seat: number | null }).seat)).toBe(1);
  await context.close();
});
