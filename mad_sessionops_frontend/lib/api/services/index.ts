/**
 * API Services
 */

import authService from "./auth.service";
import * as structureService from "./structure.service";
import * as childrenService from "./children.service";

const services = {
  auth: authService,
  structure: structureService,
  children: childrenService,
};

export default services;
