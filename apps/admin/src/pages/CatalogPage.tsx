import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@tutora/api-client';
import { describeAuthError, type Category, type Page, type Skill } from '@tutora/core';
import {
  Alert,
  Button,
  Field,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  SectionHeader,
  Select,
  Tag,
  Textarea,
} from '@tutora/ui';
import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { fieldErr, topError } from '../components';
import { keys, useAdminCategories } from '../queries';

export function CatalogPage() {
  return (
    <>
      <PageHeader
        kicker="Catalog"
        title="Sections and skills"
        description="What people can learn on Tutora. Hiding a skill removes it from search and new requests; existing bookings continue."
      />
      <div className="flex flex-col gap-14">
        <SkillsSection />
        <CategoriesSection />
      </div>
    </>
  );
}

const categoryLabel = (all: Category[], id: string) => {
  const c = all.find((x) => x.id === id);
  if (!c) return 'Unknown';
  const parent = c.parentId ? all.find((x) => x.id === c.parentId) : undefined;
  return parent ? `${parent.name} › ${c.name}` : c.name;
};

/** Parents first, children indented under them. */
function categoryOptions(all: Category[]) {
  const roots = all.filter((c) => !c.parentId);
  return roots.flatMap((r) => [r, ...all.filter((c) => c.parentId === r.id)]);
}

function CategoriesSection() {
  const qc = useQueryClient();
  const categories = useAdminCategories();
  const [creating, setCreating] = useState(false);
  const toggle = useMutation({
    mutationFn: (c: Category) =>
      unwrap(
        api.PATCH('/admin/catalog/categories/{id}', {
          params: { path: { id: c.id } },
          body: { isActive: !c.isActive },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories }),
  });
  return (
    <section aria-labelledby="sections">
      <SectionHeader
        id="sections"
        title="Sections"
        action={
          <Button variant="ghost" onClick={() => setCreating(true)}>
            + New section
          </Button>
        }
      />
      {toggle.error && <Alert tone="danger">{describeAuthError(toggle.error)}</Alert>}
      {categories.isPending ? (
        <Loading />
      ) : categories.isError ? (
        <Alert tone="danger">{categories.error.message}</Alert>
      ) : (
        <ul className="grid gap-x-8 md:grid-cols-2">
          {categoryOptions(categories.data).map((c) => (
            <li
              key={c.id}
              className={`flex items-center justify-between gap-3 border-b border-border py-3 ${c.parentId ? 'pl-6' : ''}`}
            >
              <div>
                <p className={c.parentId ? 'font-semibold' : 'font-display text-lg font-black'}>
                  {c.name}
                </p>
                <p className="text-xs text-muted">/{c.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                {!c.isActive && <Tag tone="danger">Hidden</Tag>}
                <Button
                  variant="ghost"
                  loading={toggle.isPending && toggle.variables?.id === c.id}
                  onClick={() => toggle.mutate(c)}
                >
                  {c.isActive ? 'Hide' : 'Show'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {creating && categories.data && (
        <NewCategoryDialog all={categories.data} onClose={() => setCreating(false)} />
      )}
    </section>
  );
}

function NewCategoryDialog({ all, onClose }: { all: Category[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [description, setDescription] = useState('');
  const create = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/admin/catalog/categories', {
          body: {
            name: name.trim(),
            parentId: parentId || undefined,
            description: description.trim() || undefined,
          },
        }),
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: keys.categories });
      onClose();
    },
  });
  const err = create.error;
  return (
    <Modal open title="New section" onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        {topError(err) && <Alert tone="danger">{topError(err)}</Alert>}
        <Field
          label="Name"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          error={fieldErr(err, 'name')}
        />
        <Select
          label="Inside"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          error={fieldErr(err, 'parentId')}
        >
          <option value="">Top level</option>
          {all
            .filter((c) => !c.parentId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Select>
        <Textarea
          label="Description (optional)"
          rows={2}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={fieldErr(err, 'description')}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending} disabled={name.trim().length < 2}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SkillsSection() {
  const qc = useQueryClient();
  const categories = useAdminCategories();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<Skill | 'new' | null>(null);
  const [topicFor, setTopicFor] = useState<Skill | null>(null);
  const query = { limit: 20, offset, q: search || undefined, categoryId: categoryId || undefined };
  const skills = useQuery({
    queryKey: ['admin', 'skills', query],
    queryFn: () => unwrap<Page<Skill>>(api.GET('/admin/catalog/skills', { params: { query } })),
    placeholderData: keepPreviousData,
  });
  const toggle = useMutation({
    mutationFn: (s: Skill) =>
      unwrap(
        api.PATCH('/admin/catalog/skills/{id}', {
          params: { path: { id: s.id } },
          body: { isActive: !s.isActive },
        }),
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'skills'] }),
  });
  const all = categories.data ?? [];
  return (
    <section aria-labelledby="skills">
      <SectionHeader
        id="skills"
        title="Skills"
        action={
          <Button variant="ghost" onClick={() => setEditing('new')} disabled={!all.length}>
            + New skill
          </Button>
        }
      />
      <form
        role="search"
        className="mb-6 grid gap-3 md:grid-cols-[1fr_260px_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
          setOffset(0);
        }}
      >
        <Field label="Search" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select
          label="Section"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">All sections</option>
          {categoryOptions(all).map((c) => (
            <option key={c.id} value={c.id}>
              {c.parentId ? `— ${c.name}` : c.name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {toggle.error && <Alert tone="danger">{describeAuthError(toggle.error)}</Alert>}
      {skills.isPending ? (
        <Loading />
      ) : skills.isError ? (
        <Alert tone="danger">{skills.error.message}</Alert>
      ) : (
        <>
          <ul>
            {skills.data.items.map((s) => (
              <li
                key={s.id}
                className="grid gap-3 border-b border-border py-4 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-xl font-black">{s.name}</p>
                    {!s.isActive && <Tag tone="danger">Hidden</Tag>}
                    {s.learnerNotice && <Tag tone="warning">Notice</Tag>}
                  </div>
                  <p className="text-xs text-muted">
                    {categoryLabel(all, s.categoryId)} · /{s.slug}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button variant="ghost" onClick={() => setEditing(s)}>
                    Edit
                  </Button>
                  <Button variant="ghost" onClick={() => setTopicFor(s)}>
                    + Topic
                  </Button>
                  <Button
                    variant="ghost"
                    loading={toggle.isPending && toggle.variables?.id === s.id}
                    onClick={() => toggle.mutate(s)}
                  >
                    {s.isActive ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            total={skills.data.total}
            limit={skills.data.limit}
            offset={skills.data.offset}
            onChange={setOffset}
          />
        </>
      )}
      {editing && (
        <SkillDialog
          skill={editing === 'new' ? null : editing}
          all={all}
          onClose={() => setEditing(null)}
        />
      )}
      {topicFor && <TopicDialog skill={topicFor} onClose={() => setTopicFor(null)} />}
    </section>
  );
}

function SkillDialog({
  skill,
  all,
  onClose,
}: {
  skill: Skill | null;
  all: Category[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [categoryId, setCategoryId] = useState(skill?.categoryId ?? '');
  const [name, setName] = useState(skill?.name ?? '');
  const [description, setDescription] = useState(skill?.description ?? '');
  const [notice, setNotice] = useState(skill?.learnerNotice ?? '');
  const save = useMutation({
    mutationFn: () => {
      const body = {
        categoryId,
        name: name.trim(),
        description: description.trim() || undefined,
        learnerNotice: notice.trim() || undefined,
      };
      return skill
        ? unwrap(
            api.PATCH('/admin/catalog/skills/{id}', {
              params: { path: { id: skill.id } },
              // An empty notice clears it. The backend's OpenAPI types learnerNotice here as an
              // object (string | null in reality), so the generated type needs a cast.
              body: { ...body, learnerNotice: notice.trim() || null } as never,
            }),
          )
        : unwrap(api.POST('/admin/catalog/skills', { body }));
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin', 'skills'] });
      await qc.invalidateQueries({ queryKey: ['public'] });
      onClose();
    },
  });
  const err = save.error;
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  return (
    <Modal open title={skill ? `Edit ${skill.name}` : 'New skill'} onClose={onClose}>
      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        {topError(err) && <Alert tone="danger">{topError(err)}</Alert>}
        <Select
          label="Section"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          error={fieldErr(err, 'categoryId')}
        >
          <option value="">Choose a section</option>
          {categoryOptions(all).map((c) => (
            <option key={c.id} value={c.id}>
              {c.parentId ? `— ${c.name}` : c.name}
            </option>
          ))}
        </Select>
        <Field
          label="Name"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          error={fieldErr(err, 'name')}
        />
        <Textarea
          label="Description"
          rows={3}
          maxLength={1000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={fieldErr(err, 'description')}
        />
        <Textarea
          label="Learner notice (optional)"
          rows={2}
          maxLength={500}
          value={notice}
          onChange={(e) => setNotice(e.target.value)}
          hint="Shown before booking, e.g. “Education only, not investment advice.”"
          error={fieldErr(err, 'learnerNotice')}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={save.isPending}
            disabled={!categoryId || name.trim().length < 2}
          >
            {skill ? 'Save' : 'Create skill'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TopicDialog({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const add = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/admin/catalog/skills/{id}/topics', {
          params: { path: { id: skill.id } },
          body: { name: name.trim() },
        }),
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['public', 'skill'] });
      onClose();
    },
  });
  return (
    <Modal open title={`Add a topic to ${skill.name}`} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        {topError(add.error) && <Alert tone="danger">{topError(add.error)}</Alert>}
        <Field
          label="Topic name"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          error={fieldErr(add.error, 'name')}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={add.isPending} disabled={name.trim().length < 2}>
            Add topic
          </Button>
        </div>
      </form>
    </Modal>
  );
}
