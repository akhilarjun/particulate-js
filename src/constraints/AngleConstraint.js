require('./Constraint');
lib.AngleConstraint = AngleConstraint;
function AngleConstraint(angle, a, b, c) {
  var size = a.length || arguments.length - 1;
  var min = angle.length ? angle[0] : angle;
  var max = angle.length ? angle[1] : angle;

  lib.Constraint.call(this, size);
  this.setAngle(min, max);
  this.setIndices(a, b, c);
  this._count = size / 3;
}

AngleConstraint.create = lib.ctor(AngleConstraint);
AngleConstraint.prototype = Object.create(lib.Constraint.prototype);

AngleConstraint.prototype.setAngle = function (min, max) {
  max = max != null ? max : min;
  this.setMin(min);
  this.setMax(max);
};

AngleConstraint.prototype.setMin = function (min) {
  this._min = this.clampAngle(min);
};

AngleConstraint.prototype.setMax = function (max) {
  this._max = this.clampAngle(max);
};

AngleConstraint.prototype.clampAngle = function (angle) {
  var p = 0.0000001;
  return lib.Math.clamp(p, Math.PI - p, angle);
};

AngleConstraint.ANGLE_OBTUSE = Math.PI * 0.75;

// TODO: Optimize, reduce usage of Math.sqrt
function angleConstraint_apply(p0, w0, min, max, ai, bi, ci) {
  // TODO: Refactor into smaller bits
  /*jshint maxcomplexity:15*/
  var aix = ai * 3, aiy = aix + 1, aiz = aix + 2;
  var bix = bi * 3, biy = bix + 1, biz = bix + 2;
  var cix = ci * 3, ciy = cix + 1, ciz = cix + 2;

  // AB (A -> B)
  var abX = p0[bix] - p0[aix];
  var abY = p0[biy] - p0[aiy];
  var abZ = p0[biz] - p0[aiz];

  // BC (B -> C)
  var bcX = p0[cix] - p0[bix];
  var bcY = p0[ciy] - p0[biy];
  var bcZ = p0[ciz] - p0[biz];

  // AC (A -> C)
  var acX = p0[cix] - p0[aix];
  var acY = p0[ciy] - p0[aiy];
  var acZ = p0[ciz] - p0[aiz];

  // Perturb coincident particles
  if (!(acX || acY || acZ)) {
    p0[aix] += 0.1;
    p0[biy] += 0.1;
    p0[cix] -= 0.1;
    return;
  }

  var abLenSq = abX * abX + abY * abY + abZ * abZ;
  var bcLenSq = bcX * bcX + bcY * bcY + bcZ * bcZ;
  var acLenSq = acX * acX + acY * acY + acZ * acZ;

  var abLen = Math.sqrt(abLenSq);
  var bcLen = Math.sqrt(bcLenSq);
  var acLen = Math.sqrt(acLenSq);

  var abLenInv = 1 / abLen;
  var bcLenInv = 1 / bcLen;

  var bAngle = Math.acos(
    -abX * abLenInv * bcX * bcLenInv +
    -abY * abLenInv * bcY * bcLenInv +
    -abZ * abLenInv * bcZ * bcLenInv);

  if (bAngle > min && bAngle < max) { return; }
  var bAngleTarget = bAngle < min ? min : max;

  // Target length for AC
  var acLenTargetSq = abLenSq + bcLenSq - 2 * abLen * bcLen * Math.cos(bAngleTarget);
  var acLenTarget = Math.sqrt(acLenTargetSq);
  var acDiff = (acLen - acLenTarget) / acLen * 0.5;

  p0[aix] += acX * acDiff;
  p0[aiy] += acY * acDiff;
  p0[aiz] += acZ * acDiff;

  p0[cix] -= acX * acDiff;
  p0[ciy] -= acY * acDiff;
  p0[ciz] -= acZ * acDiff;

  // Only manipulate particle B for obtuse targets
  if (bAngleTarget < AngleConstraint.ANGLE_OBTUSE) { return; }

  // Target angle for A
  var aAngleTarget = Math.acos((abLenSq + acLenTargetSq - bcLenSq) / (2 * abLen * acLenTarget));

  // Unit vector AC
  var acLenInv = 1 / acLen;
  var acuX = acX * acLenInv;
  var acuY = acY * acLenInv;
  var acuZ = acZ * acLenInv;

  // Project B onto AC as vector AP
  var pt = acuX * abX + acuY * abY + acuZ * abZ;
  var apX = acuX * pt;
  var apY = acuY * pt;
  var apZ = acuZ * pt;

  // BP (B -> P)
  var bpX = apX - abX;
  var bpY = apY - abY;
  var bpZ = apZ - abZ;

  // B is inline with AC
  if (!(bpX || bpY || bpZ)) {
    if (bAngleTarget < Math.PI) {
      p0[bix] += 0.1;
      p0[biy] += 0.1;
      p0[biz] += 0.1;
    }
    return;
  }

  var apLenSq = apX * apX + apY * apY + apZ * apZ;
  var bpLenSq = bpX * bpX + bpY * bpY + bpZ * bpZ;
  var apLen = Math.sqrt(apLenSq);
  var bpLen = Math.sqrt(bpLenSq);

  var bpLenTarget = apLen * Math.tan(aAngleTarget);
  var bpDiff = (bpLen - bpLenTarget) / bpLen;

  p0[bix] += bpX * bpDiff;
  p0[biy] += bpY * bpDiff;
  p0[biz] += bpZ * bpDiff;
}

AngleConstraint.prototype.applyConstraint = function (p0, p1, w0) {
  var min = this._min;
  var max = this._max;
  var count = this._count;
  var ii = this.indices;

  if (count === 1) {
    angleConstraint_apply(p0, w0, min, max, ii[0], ii[1], ii[2]);
    return;
  }

  var i, ai, bi, ci;
  for (i = 0; i < count; i ++) {
    ai = i * 3;
    bi = ai + 1;
    ci = ai + 2;
    angleConstraint_apply(p0, w0, min, max, ii[ai], ii[bi], ii[ci]);
  }
};
