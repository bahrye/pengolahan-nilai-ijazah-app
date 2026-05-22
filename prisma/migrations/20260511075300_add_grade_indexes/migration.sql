-- Add missing indexes for GradeEntry performance optimization
CREATE INDEX "GradeEntry_schoolId_semesterKey_scoreType_idx" ON "GradeEntry"("schoolId", "semesterKey", "scoreType");

CREATE INDEX "GradeEntry_schoolId_scoreType_idx" ON "GradeEntry"("schoolId", "scoreType");