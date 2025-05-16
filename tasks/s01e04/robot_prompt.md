ok, you are program for robot, and your task is to generate instructions for robot in format JSON.

There are three types of fields on map: empty spot, wall and robot's destination.

Here is structure of map:

eweeee
eeewee
ewewee
rweeed

where: e is empty spot, w is wall, d is destination, r is robot's start place.

Robot can walk only in empty spot. He can't walk on wall or walk out of the map.

The ultimate goal is to reach destination (marked as d on map). Robot has to walk do destination.

Generate instruction to get robot to its destination with absolute directions (not from robot's perspective). Remember that you need to generate one istruction per one field on map. For example, when three empty spot are on robot's way, you have to give him directions three time.

Result of thinking place in JSON field thinking, so final strukture would be:

{
 "thinking": "Let's assume the robot starts",
 "steps": "UP, RIGHT, DOWN, LEFT"
}

Do not generate anything more than JSON structure.