"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Segmented } from "@/components/ui/Tabs";
import type { SocialData } from "@/server/services/social";
import { useSocial } from "@/stores/social";
import { FriendList } from "./FriendList";
import { GroupsPanel } from "./GroupsPanel";
import { RequestsPanel } from "./RequestsPanel";
import { SearchPanel } from "./SearchPanel";

export const FRIENDS_TABS = ["friends", "groups", "search", "sent", "received"] as const;
export type FriendsTab = (typeof FRIENDS_TABS)[number];

/** Friends & Groups with five sub-tabs (R18). `?tab=` deep-links, e.g. to Received. */
export function FriendsTabs({ userId, username, data }: { userId: string; username: string; data: SocialData }) {
  const router = useRouter();
  const params = useSearchParams();
  const fromUrl = params.get("tab") as FriendsTab | null;
  const [tab, setTab] = useState<FriendsTab>(fromUrl && FRIENDS_TABS.includes(fromUrl) ? fromUrl : "friends");
  const received = useSocial((s) => s.received);
  const setReceived = useSocial((s) => s.setReceived);

  // The server count is authoritative after every refresh.
  useEffect(() => setReceived(data.receivedCount), [data.receivedCount, setReceived]);

  const choose = (t: FriendsTab) => {
    setTab(t);
    router.replace(t === "friends" ? "/friends" : `/friends?tab=${t}`, { scroll: false });
  };

  return (
    <div className="mt-8">
      <Segmented
        label="Friends sections"
        value={tab}
        onChange={choose}
        options={[
          { value: "friends", label: "My Friends" },
          { value: "groups", label: "Groups" },
          { value: "search", label: "Search" },
          { value: "sent", label: "Sent" },
          {
            value: "received",
            label: (
              <span className="inline-flex items-center gap-1.5">
                Received
                {received > 0 && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-amber px-1.5 text-[11px] font-extrabold leading-5 text-obsidian" aria-label={`${received} pending`}>
                    {received}
                  </span>
                )}
              </span>
            ),
          },
        ]}
      />
      <div className="mt-6">
        {tab === "friends" && <FriendList friends={data.friends} onFind={() => choose("search")} />}
        {tab === "groups" && <GroupsPanel userId={userId} groups={data.groups} friends={data.friends} />}
        {tab === "search" && <SearchPanel username={username} />}
        {tab === "sent" && <RequestsPanel mode="sent" friendRequests={data.sent.friendRequests} groupInvites={data.sent.groupInvites} />}
        {tab === "received" && <RequestsPanel mode="received" friendRequests={data.received.friendRequests} groupInvites={data.received.groupInvites} />}
      </div>
    </div>
  );
}
