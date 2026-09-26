export function isTeamCapacityError(problem: unknown) {
  return problem instanceof Error && problem.message.includes("TEAM_CAP_REACHED");
}

export function teamCapacityResponse() {
  return Response.json({
    error: "This event has reached its active workspace limit. Join an existing team or ask an Organizer for help.",
    code: "TEAM_CAP_REACHED",
  }, { status: 409 });
}
