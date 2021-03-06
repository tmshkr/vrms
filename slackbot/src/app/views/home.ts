import prisma from "lib/prisma";
import dayjs from "lib/dayjs";
import { getNextOccurrence } from "lib/rrule";
import axios from "axios";

const renderProject = (project) => {
  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `:small_blue_diamond: ${project.name}`,
    },
  };
};

const renderMeeting = (meeting) => {
  const nextMeeting = meeting.rrule
    ? getNextOccurrence(meeting.rrule)
    : meeting.start_date;

  const formatString = "YYYYMMDDTHHmmss[Z]";
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", meeting.title);
  url.searchParams.set(
    "dates",
    `${dayjs(nextMeeting).format(formatString)}/${dayjs(nextMeeting)
      .add(meeting.duration, "minutes")
      .format(formatString)}`
  );
  url.searchParams.set("details", "meeting details");
  meeting.rrule && url.searchParams.set("recur", meeting.rrule.split("\n")[1]);
  url.searchParams.set("ctz", "America/Los_Angeles");

  return {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `:small_blue_diamond: *${meeting.title}* – ${dayjs
        .tz(nextMeeting)
        .format("dddd, MMMM D, h:mm a")} – <${url}|Add to Calendar>`,
    },
  };
};

export const getHomeTab = async (slack_id) => {
  const [quote] = await axios
    .get("https://zenquotes.io/api/today")
    .then((res) => res.data)
    .catch(console.error);

  const userOverview = await prisma.user
    .findUnique({
      where: { slack_id },
      include: {
        team_assignments: {
          orderBy: { id: "asc" },
          include: { project: true },
        },
        meeting_assignments: {
          include: {
            meeting: true,
          },
        },
      },
    })
    .then((user) => {
      const userOverview = {} as any;
      userOverview.projects = user.team_assignments?.map(({ project }) =>
        renderProject(project)
      );
      userOverview.meetings = user.meeting_assignments?.map(({ meeting }) =>
        renderMeeting(meeting)
      );
      return userOverview;
    });

  return {
    user_id: slack_id,
    view: {
      type: "home",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: ":house: Welcome to VRMS",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `Here you'll find an overview of your projects and upcoming meetings.`,
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "Open Dashboard",
              emoji: true,
            },
            url: process.env.NEXTAUTH_URL,
            action_id: "open_dashboard",
            style: "primary",
          },
        },
        {
          type: "divider",
        },
        {
          type: "header",
          text: {
            type: "plain_text",
            text: ":open_file_folder: My Projects",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "plain_text",
            text: "Projects you're working on",
            emoji: true,
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "Create New Project",
              emoji: true,
            },
            action_id: "create_new_project",
          },
        },
        ...userOverview.projects,
        {
          type: "divider",
        },
        {
          type: "header",
          text: {
            type: "plain_text",
            text: ":calendar: Upcoming Meetings",
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "plain_text",
            text: "Meetings for projects",
            emoji: true,
          },
          accessory: {
            type: "button",
            text: {
              type: "plain_text",
              text: "Create New Meeting",
              emoji: true,
            },
            action_id: "create_new_meeting",
          },
        },
        ...userOverview.meetings,
        {
          type: "divider",
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `_${quote.q}_\n${quote.a}`,
          },
        },
      ],
    },
  };
};
