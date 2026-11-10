-- CreateIndex
CREATE UNIQUE INDEX "pacs_study_links_orthancStudyId_key" ON "pacs_study_links"("orthancStudyId");

-- CreateIndex
CREATE UNIQUE INDEX "pacs_study_links_studyInstanceUid_key" ON "pacs_study_links"("studyInstanceUid");

