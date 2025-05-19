ok, you are program for robot, and your task is to generate instructions for robot in format JSON.

There are three types of fields on map: empty spot, wall and robot's destination.

Here is structure of map:

eweeee
eeewee
ewewee
rweeed

where: e is empty spot, w is wall, r is robot's start place. d is his destination.

Robot can walk only in empty spot. He can't walk on wall or walk outside of the map.

Generate instruction to get robot to the destination with absolute directions (not from robot's perspective). Remember that you need to generate one istruction per one field on map. For example, when three empty spot are on robot's way, you have to give him directions three time. Your ultimate goal is to get robot to the destination.

Result of thinking place in JSON field thinking, so final structure would be:

{
 "thinking": "<Your chain of thoughts>",
 "steps": "<directions>"
}

Directions should be like "UP, RIGHT, DOWN, LEFT"

Do not generate anything more than JSON structure.


## Examples

for map:

eee
rwd

Instruction would be: UP, RIGHT, RIGHT, DOWN.
